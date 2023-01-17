// this script contains everything we need to execute a apm lookup given the config appId/vsads
async function cycleSync(_config, _logger) {

    // SETUP CYCLE CONTEXT
    var getCIArray = require("./utilities").getCIArray;
    var getNREntities = require("./utilities").getNREntities;
    var reconcileEntity = require("./utilities").reconcileEntity;
    var updateEntity = require("./utilities").updateEntity;
    var transmitEvents = require("./utilities").transmitEvents;
    var __cis = [];
    var __nrResponseJson = null;
    var __followCursor = true;
    var __cursorId = null;
    var __entityUpdatePayload = null;
    var __entityUpdateResponse = null;
    var __reportingEvents = [];
    var __total_entities_processes = 0;
    var __total_cis_returned = 0;
    var __total_nr_entities_returned = 0;
    var __total_entity_updates = 0;
    var __total_entity_duplicates = 0;
    var __total_entity_failures = 0;
    var __auditEvent = null;
    var __cycleResponse = 'Cycle Complete';

    //synchronization run reporting
    __reportingEvents.push({
        "eventType": _config.nrdb_entitysync_event_name,
        "action": "init",
        "version": _config.version,
        "ci_type_cardinality": _config.ci_types.length
      });

    /* loop the candidate cis from ServiceNow */
    for (var i = 0; i < _config.ci_types.length; i++) {

        __followCursor = true; //ensuring the entity loop is re-set in advance of subsequent entity lookups
        __cursorId = null; //reset cursor for next type
        _logger.info("[ entitysync::cycleSync ] Running Sync for type: " + _config.ci_types[i].type);
        _logger.info("[ entitysync::cycleSync ] Syncing with NR entity domain: " + _config.ci_types[i].nr_entity_domain + " and type: " + _config.ci_types[i].nr_entity_type);
        __cis = await getCIArray(_config, _config.ci_types[i], _logger);
        _logger.info("[ entitysync::cycleSync ] CIs returned: " + __cis.length);
        __total_cis_returned += __cis.length;
        __total_nr_entities_returned = 0; //reset the entities returned count


       //synchronization run reporting
        __reportingEvents.push({
            "eventType": _config.nrdb_entitysync_event_name,
            "action": "ci_harvest",
            "version": _config.version,
            "ci_cardinality": __cis.length,
            "ci_table": _config.ci_types[i].type
        });

        while(__followCursor) {

            try {

                __nrResponseJson = await getNREntities(_config, _config.ci_types[i], __cursorId, _logger);

                if (__nrResponseJson !== null && __nrResponseJson.data.actor.entitySearch !== null) {

                    if (__nrResponseJson.data.actor.entitySearch.results.entities !== undefined) {

                        let entityLength = __nrResponseJson.data.actor.entitySearch.results.entities.length;
                        _logger.verbose("[ entitysync::cycleSync ] New Relic Entities Returned: " + entityLength)
                        __total_nr_entities_returned += entityLength;

                        for (var j = 0; j < __nrResponseJson.data.actor.entitySearch.results.entities.length; j++) {

                            __total_entities_processes++; // reporting number of entities processed
                            __entityUpdatePayload = await reconcileEntity(_config.ci_types[i], __nrResponseJson.data.actor.entitySearch.results.entities[j], __cis, _logger);

                            if (__entityUpdatePayload.found) {
                                _logger.debug("[ entitysync::cycleSync ] Found Entity: " + __entityUpdatePayload.name)

                                // //record audit message of a reconciled CI/Entity pair
                                // __auditEvent = {};
                                // __auditEvent.eventType = _config.nrdb_entitysync_event_name;
                                // __auditEvent.action = "ci_processed";
                                // __auditEvent.version = _config.version;
                                // __auditEvent.found = __entityUpdatePayload.found;
                                // __auditEvent.entity_guid = __entityUpdatePayload.entity_guid;
                                // __auditEvent.entity_name = __entityUpdatePayload.name;
                                // __auditEvent.entity_update_allowed = _config.provider.update_entity;

                                // //add the new tags to the audit event
                                // for (var zz = 0; zz < __entityUpdatePayload.tags.length; zz++) {
                                //     _logger.verbose("[ entitysync::cycleSync ] tag candidate: " + __entityUpdatePayload.tags[zz].key + " with value " + __entityUpdatePayload.tags[zz].value);
                                //     __auditEvent[__entityUpdatePayload.tags[zz].key] = __entityUpdatePayload.tags[zz].value;
                                // } //for


                                if (_config.provider.update_entity === true) {

                                    __entityUpdateResponse = await updateEntity(_config, __entityUpdatePayload, _logger);
                                    // __auditEvent.entity_update_status = __entityUpdateResponse.message;

                                    if (__entityUpdateResponse.message === "SUCCESS") {
                                        __total_entity_updates++;
                                    } //if
                                    else if (__entityUpdateResponse.message === "SKIPPED") {
                                        __total_entity_duplicates++;
                                    }
                                    else {
                                        __total_entity_failures++;
                                    } //else
                                    _logger.info("[ entitysync::cycleSync ] Updating Entity: " + __entityUpdateResponse.name + " : " + __entityUpdateResponse.entity_guid + " --> " + __entityUpdateResponse.message);

                                } //if
                                else {

                                    __auditEvent.entity_update_status = "NO UPDATE ATTEMPT";
                                    _logger.verbose("[ entitysync::cycleSync ] NO UPDATE ATTEMPT")
                                } //else

                                // __reportingEvents.push(__auditEvent);
                                _logger.verbose("[ entitysync::cycleSync ]This is the audit event: ", __auditEvent);

                            } //if
                            else {

                                _logger.verbose("[ entitysync::cycleSync ] No match found for " + __entityUpdatePayload.name + " : " + __entityUpdatePayload.entity_guid);
                            } //else
                        } //for
                    } //if
                    else {

                        _logger.error("[ entitysync::cycleSync ] Undefined entities returned from search: ", __nrResponseJson);
                        throw 'Undefined entities following entitySearch';
                    } //else

                } //if
                else {

                    _logger.error("[ entitysync::cycleSync ] No entities returned from search: ", __nrResponseJson);
                } //else


                if (__nrResponseJson.data.actor.entitySearch.results.nextCursor === null) {

                    __followCursor = false;
                } //if
                else {

                    __cursorId =  __nrResponseJson.data.actor.entitySearch.results.nextCursor;
                } //else

            } //try
            catch(_err) {

                __cursorId = null;
                __followCursor = false;
                _logger.error("[ entitysync::cycleSync ] Problem resolving Entity details: ", _err);
                __cycleResponse = "Problem in Sync results may be incomplete"
            } //catch

        } //while

        _logger.info("[ entitysync::cycleSync ] NR Entities Scanned: " + __total_nr_entities_returned);
    } //for

    //synchronization run reporting
    __reportingEvents.push({
        "eventType": _config.nrdb_entitysync_event_name,
        "action": "entity_complete",
        "version": _config.version,
        "total_entities_processed": __total_entities_processes,
        "total_cis_returned": __total_cis_returned,
        "total_entities_update_success": __total_entity_updates,
        "total_entities_update_failure": __total_entity_failures,
        "total_entities_update_skipped": __total_entity_duplicates
    });

    if (__reportingEvents.length > 0) {

        transmitEvents(_config, __reportingEvents, _logger);
    } //if

    return(__cycleResponse);
} // cycleSync

module.exports = {
    cycleSync: cycleSync
};
