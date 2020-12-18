const { COPYFILE_FICLONE_FORCE } = require('constants');
const e = require('express');

async function getCIArray(_config, _ci_type) {

    const fetch = require('isomorphic-fetch');
    var base64 = require('base-64');
    var __cis = [];
    var __json_response = null;

    try {

        const __response = await fetch(_config.snow_url + _ci_type.api + _ci_type.api_query_parms, {
                method: _ci_type.api_method,
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic '+ base64.encode(_config.snow_api_uname+':'+_config.snow_api_pword)
                }
            });

        __json_response = await __response.json();
        __cis = __json_response.result;
//        console.log("SNOW RESPONSE ", __json_response);
    } //try
    catch (_err) {

        console.error("[utilities::getCIArray] NO CIs FOUND - NO SYNC WILL HAPPEN", _err);

    } //catch

    return(__cis);
} //getCIArray


async function getNREntities(_config, _entity_shape, _cursor) {

    const fetch = require('isomorphic-fetch');
    var __query = ``;
    var __json_response = null;
    
    if (_cursor === null) {

        __query = `{
            actor {
              entitySearch(queryBuilder: {domain: ${_entity_shape.nr_entity_domain}, type: ${_entity_shape.nr_entity_type}}) {
                results {
                  entities {
                    guid
                    tags {
                      key
                      values
                    }
                    name
                    accountId
                  }
                  nextCursor
                }
              }
            }
          }`;

    } //if
    else {

        __query = `{
            actor {
              entitySearch(queryBuilder: {domain: ${_entity_shape.nr_entity_domain}, type: ${_entity_shape.nr_entity_type}}) {
                results(cursor: "${_cursor}") {
                  entities {
                    guid
                    tags {
                      key
                      values
                    }
                    name
                    accountId
                  }
                  nextCursor
                }
              }
            }
          }`;
    } //else 

    try { 

        const __response = await fetch('https://api.newrelic.com/graphql', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'API-Key': _config.nr_graph_api_key
            },
            body: JSON.stringify({ 
                query: __query,
            variables: ''}),
        });

        __json_response = await __response.json();

    } //try
    catch(_err) {

        console.log("Problem querying for entities: " + _domain + " cursor: " + _cursor);
        console.error("[utilities::getNREntities]", _err);
    } //catch

    return(__json_response);

} //getNREntities

async function reconcileEntity(_ciType, _entity, _candidateCIs) { 

//    console.log("Entity: ", _entity);
    var __entityUpdatePayload = {
        found: false,
        entity_guid: _entity.guid,
        name: _entity.name,
        tags: []
    };

    //right now I am just going to loop the array but this should be more sophisticated
    for (var i = 0; i < _candidateCIs.length; i++) {

        // select matching strategy
        if (_ciType.nr_entity_key.strategy === "caseless_match") {

            
            if (_candidateCIs[i].name.toUpperCase() === _entity.name.toUpperCase()) {

                __entityUpdatePayload.found = true;
                __entityUpdatePayload.tags = await _formatAdditiveTags(_entity, _ciType, _candidateCIs[i]);
                break;
            } //if

        } //if
        else if (_ciType.nr_entity_key.strategy === "exact_match") {

            if (_candidateCIs[i].name === _entity.name) {

                __entityUpdatePayload.found = true;
                __entityUpdatePayload.tags = await _formatAdditiveTags(_entity, _ciType, _candidateCIs[i]);
                break;
            } //if

        } //else if
        else {

            console.log("No key matching strategy recognized, please review config.json.");
        } //else

    } //for


    return(__entityUpdatePayload);

} //reconcileEntity

async function updateEntity(_config, _entityUpdate) {


    const fetch = require('isomorphic-fetch');
    console.log("This is an update ... ", _entityUpdate);
    var __entityUpdateResponse = _entityUpdate;
    __entityUpdateResponse.message = "SUCCESS";
    var __mutation = null;
    var __apiResponse = null;
    var __responseJson = null;

    for (var i = 0; i < _entityUpdate.tags.length; i++) {

        __mutation = `mutation { 
            taggingAddTagsToEntity(guid: "${_entityUpdate.entity_guid}", tags: {key: "${_entityUpdate.tags[i].key}", values: ["${_entityUpdate.tags[i].value}"]}) {
                errors {
                    message
                    type
                }
            }
        }`;

        try {

            __apiResponse = await fetch('https://api.newrelic.com/graphql', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'API-Key': _config.nr_graph_api_key
                },
                body: JSON.stringify({ 
                    query: __mutation,
                    variables: ''}),
                });
    
            __responseJson = await __apiResponse.json();
            console.log("Write response", __responseJson);
            console.log("Write response errz", __responseJson.data.taggingReplaceTagsOnEntity.errors);
            
        } //try
        catch(_err) { 
    
            console.log("Problem writing tag for entity: " + _entityUpdate.name + " trying to write " + _entityUpdate.tags[i].key + " : " + _entityUpdate.tags[i].value);
            console.error("[utilities::updateEntity]", _err);
            __entityUpdateResponse.message = "FAILURE: " + _err;
        } //catch

    } //for

    return(__entityUpdateResponse);

} //updateEntity

async function _formatAdditiveTags(_entity, _ciType, _ci) {

    var __entityTags = [];
    var __tagEvaluator = false;

    // loop the tag array defined in the ci configuration
    for (var i = 0; i < _ciType.tags.length; i++) {
    
        __tagEvaluator = await _entityHasTagAndValue(_entity, _ciType.nr_entity_tag_key[_ciType.tags[i]], _ci[_ciType.tags[i]]);

        if (!__tagEvaluator) {

            //check to see that we are not pushing a null string - api does not cotton to this.
            if (_ci[_ciType.tags[i]] !== '') {
                __entityTags.push({
                    key: _ciType.nr_entity_tag_key[_ciType.tags[i]],
                    value: _ci[_ciType.tags[i]]
                });
            } //if
            else{
                console.log("Attempting to update an Entity wwith a tag where there is no value, skipping. Tag: " + _ciType.nr_entity_tag_key[_ciType.tags[i]] + " --> " + _ci[_ciType.tags[i]]);
            } //else

        } //if

    } //for
    console.log("entity tags being added: ",  __entityTags);
    return (__entityTags);
} // _formatAdditiveTags

async function _entityHasTagAndValue(_entity, _key, _value) {
console.log("The entity: ", _entity);
console.log("The key: ", _key);
console.log("The value: ", _value);

    var __rc = false;
console.log("______________________________________ loop");
    for (var i = 0; i < _entity.tags.length; i++) {
//
//        console.log("entity tag: " + _entity.tags[i].key);
//        console.log("propsoed key: " + _key);
        //does this entity have the tag get 
        if (_entity.tags[i].key === _key) {

//            console.log("entity valueL: ", _entity.tags[i].values);
//            console.log("proposed value: " + _value);
            //does this entity's tag value the same
            if (_entity.tags[i].values.includes(_value)) {
                __rc = true;
                console.log("value matches!");
            } //if
            else {
                console.log("values does not match");
            } //else
        } //if
        else {
            console.log("no match");
        } //else
    } //for
console.log("______________________________________ loop");

    return(__rc);
} //_entityHasTag


module.exports = {
    getCIArray: getCIArray,
    getNREntities: getNREntities,
    reconcileEntity: reconcileEntity,
    updateEntity: updateEntity
};