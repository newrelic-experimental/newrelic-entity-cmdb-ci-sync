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

        console.error("NO CI FOUND - NO SYNC WILL HAPPEN", _err);

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

    console.log("Entity: ", _entity);
    var __entityUpdatePayload = {
        found: false,
        entity_guid: _entity.guid,
        name: _entity.name,
        tags: []
    };

    //right now I am just going to loop the array but this should be more sophisticated
    for (var i = 0; i < _candidateCIs.length; i++) {

        if (_candidateCIs[i].name === _entity.name) {

            __entityUpdatePayload.found = true;

            //set the tag:key relationship we want to persist
            for (var j = 0; j < _ciType.tags.length; j++) {

                __entityUpdatePayload.tags.push({
                    key: _ciType.nr_entity_tag_key[_ciType.tags[j]],
                    value: _candidateCIs[i][_ciType.tags[j]]
                });
                //console.log("value: ",  __entityUpdatePayload);
            } //for
  
            console.log("found match " + _entity.name, _candidateCIs[i]);
            break;

        } //if
        else {

           // console.log("no match .... ");
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
            
        } //try
        catch(_err) { 
    
            console.log("Problem writing tag for entity: " + _entity + " trying to write " + _value);
            console.error("[utilities::updateEntity]", _err);
            __entityUpdateResponse.message = "FAILURE: " + _err;
        } //catch

    } //for

    return(__entityUpdateResponse);

} //updateEntity

module.exports = {
    getCIArray: getCIArray,
    getNREntities: getNREntities,
    reconcileEntity: reconcileEntity,
    updateEntity: updateEntity
};