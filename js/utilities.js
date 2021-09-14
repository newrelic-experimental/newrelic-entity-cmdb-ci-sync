const { loggers } = require('winston');

async function getCIArray(_config, _ci_type, _logger) {
console.log("called");
    var __cis = [];

    try {

        if (_config.provider.type === "servicenow") {

            __cis = await _getServiceNowCIs(_config, _ci_type, _logger);
        } //if
        else {

            _logger.error("[utilities::getCIArray] UNKNOWN PROVIDER TYPE - NO SYNC WILL HAPPEN",);
        } //else

    } //try
    catch (_err) {

        _logger.error("[utilities::getCIArray] NO CIs FOUND - NO SYNC WILL HAPPEN", _err);

    } //catch

    return(__cis);
} //getCIArray

/* TODO this is ServiceNow specific and needs to be made generic - output based on parameter */
async function _getLastUpdateTS(_config, _logger) {

    const fetch = require('isomorphic-fetch');
    const HttpsProxyAgent = require('https-proxy-agent');
    var __proxy_agent = null;
    var __response = null;
    var __json_response = null;
    var __lastUpdateTS = null;

    try {

        if (_config.proxy.enabled) {

            __proxy_agent = new HttpsProxyAgent(_config.proxy.address);
            __response = await fetch('https://api.newrelic.com/graphql', {
                method: 'POST',
                agent: __proxy_agent,
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': _config.nr_graph_api_key
                },
                body: JSON.stringify({
                    query: `{
                        actor {
                          account(id: ${_config.nr_graph_api_account}) {
                            nrql(query: "SELECT latest(timestamp) FROM ${_config.nrdb_entitysync_event_name} SINCE 1 MONTH AGO") {
                              results
                            }
                          }
                        }
                    }`,
                    variables: ''
                }),
            });
        } //if
        else {
            __response = await fetch('https://api.newrelic.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': _config.nr_graph_api_key
                },
                body: JSON.stringify({
                    query: `{
                        actor {
                          account(id: ${_config.nr_graph_api_account}) {
                            nrql(query: "SELECT latest(timestamp) FROM ${_config.nrdb_entitysync_event_name} SINCE 1 MONTH AGO") {
                              results
                            }
                          }
                        }
                    }`,
                    variables: ''
                }),
            });
        } //else

        __json_response = await __response.json();

        // returns suitably old date to query all records
        if (__json_response.data.actor.account.nrql.results[0]["latest.timestamp"] === undefined) {
            __lastUpdateTS = `'1973-03-17'%2C'00%3A00%3A00'`;
        } //if
        else {
            var __date = new Date(Number(__json_response.data.actor.account.nrql.results[0]["latest.timestamp"]));
            __lastUpdateTS = `'${__date.getFullYear()}-${("0" + (__date.getMonth() + 1)).slice(-2)}-${("0" + __date.getDate()).slice(-2)}'%2C'${("0" +  __date.getHours()).slice(-2)}%3A00%3A00'`;
            _logger.verbose("Last updated timestamp is: " + __lastUpdateTS);
        } //else
    } //try
    catch(_err) {

        _logger.error("[utilities:getLastUpdateTS] Problem getting timestamp for CMDB Sync from " + _config.nrdb_entitysync_event_name + " NRDB Table.");
        _logger.error("[utilities::getLastUpdateTS]", _err);
        __lastUpdateTS = `'1973-03-17'%2C'00%3A00%3A00'`;
    } //catch

    return(__lastUpdateTS);
} //getLastUpdateTS

async function getNREntities(_config, _entity_shape, _cursor, _logger) {

    const fetch = require('isomorphic-fetch');
    const HttpsProxyAgent = require('https-proxy-agent');
    var __proxy_agent = null;
    var __query = ``;
    var __json_response = null;
    var __response = null;

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

        if (_config.proxy.enabled) {

            __proxy_agent = new HttpsProxyAgent(_config.proxy.address);
            __response = await fetch('https://api.newrelic.com/graphql', {
                method: 'POST',
                agent: __proxy_agent,
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': _config.nr_graph_api_key
                },
                body: JSON.stringify({
                    query: __query,
                variables: ''}),
            });

        } //if
        else {

            __response = await fetch('https://api.newrelic.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': _config.nr_graph_api_key
                },
                body: JSON.stringify({
                    query: __query,
                variables: ''}),
            });
        } //else

        __json_response = await __response.json();

    } //try
    catch(_err) {

        _logger.error("Problem querying for entities: " + _domain + " cursor: " + _cursor);
        _logger.error("[utilities::getNREntities]", _err);
    } //catch

    return(__json_response);
} //getNREntities

async function reconcileEntity(_ciType, _entity, _candidateCIs, _logger) {

   // console.log("Entity to reconcile: ", _entity);
    var __entityUpdatePayload = {
        found: false,
        entity_guid: _entity.guid,
        name: _entity.name,
        tags: [],
        ci: null
    };

    var __entity_key = null;

    // determine the entity key
    if (_ciType.nr_entity_key.type === 'attribute') {

        // we will use the Entity attributes to reconcile the candidate CI
        __entity_key = _entity[_ciType.nr_entity_key.key];
    } // if
    else if (_ciType.nr_entity_key.type === 'tag') {

        // we will use the Entity tag value to reconcile the candidate CI
        var __tags = _entity.tags.filter(tagset => tagset.key === _ciType.nr_entity_key.key);

        if (__tags.length > 0) {
            if (__tags[0].values.length > 0) {
                // in the case we have found arrays we will select the first array element
                __entity_key = __tags[0].values[0];
            } // if
        } //if
        else {
            _logger.error("[utilities:reconcileEntity] No tag value found for " + _ciType.nr_entity_key.key + " on entity " + _entity.name);
            return(__entityUpdatePayload);
        } //else

    } // else if
    else {

        // unknown type key - no match will be possible
        _logger.error("[utilities:reconcileEntity] Unexpected nr_entity_key.type encountered " + _ciType.nr_entity_key.type + " no match possible. Check your config.json.");
        return(__entityUpdatePayload);
    } //else

    // loop the array to provide opportunities for deep inspection
    for (var i = 0; i < _candidateCIs.length; i++) {

        // select matching strategy
        if (_ciType.nr_entity_key.strategy === "caseless_match") {

            if (_candidateCIs[i][_ciType.key].toUpperCase() === __entity_key.toUpperCase()) {
                __entityUpdatePayload.found = true;
                __entityUpdatePayload.ci = _candidateCIs[i];
                __entityUpdatePayload.tags = await _formatAdditiveTags(_entity, _ciType, _candidateCIs[i], _logger);
                break;
            } //if

        } //if
        else if (_ciType.nr_entity_key.strategy === "exact_match") {

            if (_candidateCIs[i][_ciType.key] === __entity_key) {
                __entityUpdatePayload.found = true;
                __entityUpdatePayload.ci = _candidateCIs[i];
                __entityUpdatePayload.tags = await _formatAdditiveTags(_entity, _ciType, _candidateCIs[i], _logger);
                break;
            } //if

        } //else if
        else if (_ciType.nr_entity_key.strategy === "exact_contains") {

            if (_candidateCIs[i][_ciType.key].includes(__entity_key)) {
                 __entityUpdatePayload.found = true;
                 __entityUpdatePayload.ci = _candidateCIs[i];
                 __entityUpdatePayload.tags = await _formatAdditiveTags(_entity, _ciType, _candidateCIs[i], _logger);
                 break;
             } //if

        } //else if
        else if (_ciType.nr_entity_key.strategy === "caseless_contains") {

            if (_candidateCIs[i][_ciType.key].toUpperCase().includes(__entity_key.toUpperCase())) {
                 __entityUpdatePayload.found = true;
                 __entityUpdatePayload.ci = _candidateCIs[i];
                 __entityUpdatePayload.tags = await _formatAdditiveTags(_entity, _ciType, _candidateCIs[i], _logger);
                 break;
            } //if

        } //else if
        else if (_ciType.nr_entity_key.strategy === "inverse_caseless_contains") {

            if (__entity_key.toUpperCase().includes(_candidateCIs[i][_ciType.key].toUpperCase())) {
                 __entityUpdatePayload.found = true;
                 __entityUpdatePayload.ci = _candidateCIs[i];
                 __entityUpdatePayload.tags = await _formatAdditiveTags(_entity, _ciType, _candidateCIs[i], _logger);
                 break;
            } //if

        } // else if
        else {

            _logger.info("No key matching strategy recognized, please review config.json.");
        } //else

    } //for

    return(__entityUpdatePayload);
} //reconcileEntity

async function updateEntity(_config, _entityUpdate, _logger) {

    const fetch = require('isomorphic-fetch');
    const HttpsProxyAgent = require('https-proxy-agent');

    var __entityUpdateResponse = _entityUpdate;
    __entityUpdateResponse.message = "SUCCESS";
    var __mutation = null;
    var __apiResponse = null;
    var __responseJson = null;
    var __proxy_agent = null;

    if (_entityUpdate.tags.length === 0) {

        __entityUpdateResponse.message = "SKIPPED";
    } //if

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

            if (_config.proxy.enabled) {

                __proxy_agent = new HttpsProxyAgent(_config.proxy.address);
                __apiResponse = await fetch('https://api.newrelic.com/graphql', {
                    method: 'POST',
                    agent: __proxy_agent,
                    headers: {
                        'Content-Type': 'application/json',
                        'API-Key': _config.nr_graph_api_key
                    },
                    body: JSON.stringify({
                        query: __mutation,
                        variables: ''}),
                    });
            } //if
            else {

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
            } //else

            __responseJson = await __apiResponse.json();
            _logger.info("Write response", __responseJson);
            _logger.info("Write response errz", __responseJson.data.taggingAddTagsToEntity.errors); //TODO adding - review context

        } //try
        catch(_err) {

            _logger.error("Problem writing tag for entity: " + _entityUpdate.name + " trying to write " + _entityUpdate.tags[i].key + " : " + _entityUpdate.tags[i].value);
            _logger.error("[utilities::updateEntity]" + JSON.stringify(_err));
            __entityUpdateResponse.message = "FAILURE: " + _err;
        } //catch

    } //for

    return(__entityUpdateResponse);

} //updateEntity

async function _formatAdditiveTags(_entity, _ciType, _ci, _logger) {

    var __entityTags = [];
    var __tagEvaluator = false;
    var __ciTagValue = "";

    // loop the tag array defined in the ci configuration
    for (var i = 0; i < _ciType.tags.length; i++) {

        __ciTagValue = await _getCIAttributeValue(_ci, _ciType.tags[i], _logger);
        __tagEvaluator = await _entityHasTagAndValue(_entity, _ciType.nr_entity_tag_key[_ciType.tags[i]], __ciTagValue, _logger);

        if (!__tagEvaluator) {

            //check to see that we are not pushing a null string - api does not cotton to this.
            if (_ci[__ciTagValue] !== '') {
                __entityTags.push({
                    key: _ciType.nr_entity_tag_key[_ciType.tags[i]],
                    value: __ciTagValue
                });
            } //if
            else{
                _logger.info("Attempting to update an Entity with a tag where there is no value, skipping. Tag: " + _ciType.nr_entity_tag_key[_ciType.tags[i]] + " --> " + _ciType.tags[i]);
            } //else

        } //if
        else {
            _logger.info("Entity already has tag and the same value, skipping update.")
        } //else

    } //for
     _logger.verbose("Entity tags being added: ",  __entityTags);
    return (__entityTags);
} // _formatAdditiveTags

/**
 * Retrieves the value of the defined tag from the candidate CI. Supports one level of nested object.
 * @param {*} _ci
 * @param {*} _ciTypeTag
 */
async function _getCIAttributeValue(_ci, _ciTypeTag, _logger) {

    var __tagValue;

    if (_ciTypeTag.includes(".")){
        //TODO support more nesting
        __tagValue = _ci[_ciTypeTag.slice(0, _ciTypeTag.indexOf("."))][_ciTypeTag.slice(_ciTypeTag.indexOf(".") + 1, _ciTypeTag.length)];
    } //if
    else {
        __tagValue = _ci[_ciTypeTag];
    } //else

    return(__tagValue);
} //_getCIAttributeValue

async function _entityHasTagAndValue(_entity, _key, _value, _logger) {
    _logger.debug("The entity: ", _entity);
    _logger.debug("The key: ", _key);
    _logger.debug("The value: ", _value);

    var __rc = false;

    for (var i = 0; i < _entity.tags.length; i++) {

        if (_entity.tags[i].key === _key) {
            //does this entity's tag value the same
            if (_entity.tags[i].values.includes(_value)) {
                __rc = true;
            } //if
        } //if
    } //for

    return(__rc);
} //_entityHasTag

async function _getServiceNowCIs(_config, _ci_type, _logger) {
console.log("called");
    const fetch = require('isomorphic-fetch');
    const base64 = require('base-64');
    const HttpsProxyAgent = require('https-proxy-agent');
    var __proxy_agent = null;
    var __cis = [];
    var __api_response = null;
    var __json_response = null;
    var __request_url = null;
    var __last_timestamp = null;
    var __modified_query_parms = null;
    var __limit = _ci_type.api_page_size;
    var __limitParm = null;
    var __offset = 0;
    var __offsetParm = null;
    var __totalRecords = null;

    try {

        if (_ci_type.api_query_parms.includes("${sys_updated_on}")) {

            __last_timestamp = await _getLastUpdateTS(_config, _logger);
            __modified_query_parms = _ci_type.api_query_parms.replace("${sys_updated_on}", __last_timestamp);
        } //if
        else {
            __modified_query_parms = _ci_type.api_query_parms;
        } //else

        __limitParm = "&sysparm_limit=" + _ci_type.api_page_size;
        __offsetParm = "&sysparm_offset=" + __offset;
        __request_url = _config.provider.api_url + _ci_type.api + __modified_query_parms + __limitParm + __offsetParm;
        //console.log("request url: " + __request_url);

        if (_config.proxy.enabled) {

            __proxy_agent = new HttpsProxyAgent(_config.proxy.address);
            __api_response = await fetch(__request_url, {
                method: _ci_type.api_method,
                agent: __proxy_agent,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic '+ base64.encode(_config.provider.api_uname+':'+_config.provider.api_pword)
                }
            });
        } //if
        else {

            __api_response = await fetch(__request_url, {
                method: _ci_type.api_method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic '+ base64.encode(_config.provider.api_uname+':'+_config.provider.api_pword)
                }
            });
        } //else

        __json_response = await __api_response.json();
        _logger.verbose(JSON.stringify(__json_response));
        __cis = __json_response.result;
        __totalRecords = await __api_response.headers.get('X-Total-Count');
        //console.log("CIs:", __cis);

        if (__totalRecords > __limit) {
          do {
            __offset = __offset + __limit;
            __offsetParm = "&sysparm_offset=" + __offset;
            __request_url = _config.provider.api_url + _ci_type.api + __modified_query_parms + __limitParm + __offsetParm;

            if (__offset > __totalRecords) {
              break;
            }

            if (_config.proxy.enabled) {

                __proxy_agent = new HttpsProxyAgent(_config.proxy.address);
                __api_response = await fetch(__request_url, {
                    method: _ci_type.api_method,
                    agent: __proxy_agent,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic '+ base64.encode(_config.provider.api_uname+':'+_config.provider.api_pword)
                    }
                });
            } //if
            else {
                __api_response = await fetch(__request_url, {
                    method: _ci_type.api_method,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic '+ base64.encode(_config.provider.api_uname+':'+_config.provider.api_pword)
                    }
                });
            } //else
            __json_response = await __api_response.json();
            __cis = __cis.concat(__json_response.result);
          } while (__offset < totalRecords) //do-while
        } //if
    } //try
    catch (_err) {

        _logger.error("[utilities::_getServiceNowCIs] NO CIs FOUND - NO SYNC WILL HAPPEN", _err);
    } //catch

    return(__cis);
} //_getServiceNowCIs

async function transmitEvents(_config, _eventsArray, _logger) {
    _logger.verbose("Transmitting events ... ");
    if (_eventsArray.length > 0) {

        const fetch = require('isomorphic-fetch');
        const HttpsProxyAgent = require('https-proxy-agent');
        var __proxy_agent = null;
        var __response = null;

        try {

            if (_config.proxy.enabled) {

                __proxy_agent = new HttpsProxyAgent(_config.proxy.address);
                __response = await fetch(_config.nrdb_insert_url, {
                    method: 'POST',
                    agent: __proxy_agent,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Insert-Key': _config.nrdb_insert_api_key
                    },
                    body: JSON.stringify(_eventsArray)
                });

            } //if
            else {
                __response = await fetch(_config.nrdb_insert_url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Insert-Key': _config.nrdb_insert_api_key
                    },
                    body: JSON.stringify(_eventsArray)
                });
            } //else

            _logger.info(">> Event Transmit Result: " + __response.ok);
        } //try
        catch (_err) {

            _logger.error("APM: Failure transmitting events. ", _err);
        } //catch

    } //if
    else {
        _logger.info("No events to transmit");
    } //else
} //transmitEvents

module.exports = {
    getCIArray: getCIArray,
    getNREntities: getNREntities,
    reconcileEntity: reconcileEntity,
    updateEntity: updateEntity,
    transmitEvents: transmitEvents
};
