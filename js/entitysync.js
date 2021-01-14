// this script contains everything we need to execute a apm lookup given the config appId/vsads
async function cycleSync(_config) {

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
    var __total_entity_updates = 0;
    var __total_entity_duplicates = 0;
    var __total_entity_failures = 0;

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
        console.log("Running Sync for type: " + _config.ci_types[i].type);
        __cis = await getCIArray(_config, _config.ci_types[i]); //prospective CIs 10000 max
        console.log("CIs returned: " + __cis.length);
        
       //synchronization run reporting
        __reportingEvents.push({
            "eventType": _config.nrdb_entitysync_event_name,
            "action": "ci_harvest",
            "version": _config.version,
            "ci_cardinality": __cis.length
        });

        while(__followCursor) {
            
            try { 
                
                __nrResponseJson = await getNREntities(_config, _config.ci_types[i], __cursorId);

                if (__nrResponseJson !== null && __nrResponseJson.data.actor.entitySearch !== null) { 

                    if (__nrResponseJson.data.actor.entitySearch.results.entities !== undefined) { 

                        for (var j = 0; j < __nrResponseJson.data.actor.entitySearch.results.entities.length; j++) {

                            __total_entities_processes++; // reporting number of entities processed
                            __entityUpdatePayload = await reconcileEntity(_config.ci_types[i], __nrResponseJson.data.actor.entitySearch.results.entities[j], __cis);

                            if (__entityUpdatePayload.found) {
                                
                                __entityUpdateResponse = await updateEntity(_config, __entityUpdatePayload);
                                
                                if (__entityUpdateResponse.message === "SUCCESS") {
                                    __total_entity_updates++;
                                } //if
                                else if (__entityUpdateResponse.message === "SKIPPED") {
                                    __total_entity_duplicates++;
                                }
                                else { 
                                    __total_entity_failures++;
                                } //else
                                console.log("Updating Entity: " + __entityUpdateResponse.name + " : " + __entityUpdateResponse.entity_guid + " --> " + __entityUpdateResponse.message);
                            } //if
                            else {

                                console.log("No match found for " + __entityUpdatePayload.name + " : " + __entityUpdatePayload.entity_guid);
                            } //else
                        } //for
                    } //if
                    else {

                        console.error("Undefined entities returned from search: ", __nrResponseJson);
                        throw 'Undefined entities following entitySearch';
                    } //else 

                } //if
                else {

                    console.error("No entities returned from search: ", __nrResponseJson);
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
                console.error("Problem resolving Entity details: ", _err);
            } //catch

        } //while

    } //for

    //synchronization run reporting
    __reportingEvents.push({
        "eventType": _config.nrdb_entitysync_event_name,
        "action": "entity_complete",
        "version": _config.version,
        "total_entities_processed": __total_entities_processes,
        "total_entities_update_success": __total_entity_updates,
        "total_entities_update_failure": __total_entity_failures,
        "total_entities_update_skipped": __total_entity_duplicates
    });

    if (__reportingEvents.length > 0) {

        transmitEvents(_config, __reportingEvents);
    } //if

    console.log("Cycle Complete");
} // cycleSync

module.exports = {
    cycleSync: cycleSync
};