// this script contains everything we need to execute a apm lookup given the config appId/vsads
async function cycleSync(_config) {

    // SETUP CYCLE CONTEXT 
    var getCIArray = require("./utilities").getCIArray;
    var getNREntities = require("./utilities").getNREntities;
    var reconcileEntity = require("./utilities").reconcileEntity;
    var updateEntity = require("./utilities").updateEntity;
    var __cis = [];
    var __nrResponseJson = null;
    var __followCursor = true;
    var __cursorId = null;
    var __entityUpdatePayload = null;
    var __entityUpdateResponse = null;

    /* loop the candidate cis from ServiceNow */
    for (var i = 0; i < _config.ci_types.length; i++) {

        __cis = await getCIArray(_config, _config.ci_types[i]); //prospective CIs 10000 max
        console.log("CIs: " + __cis.length);
       // console.log("CIs: ", __cis);

        while(__followCursor) {
            
            try { 
                
                __nrResponseJson = await getNREntities(_config, _config.ci_types[i], __cursorId);
//console.log("nr entity query resp", __nrResponseJson);
                if (__nrResponseJson !== null && __nrResponseJson.data.actor.entitySearch !== null) { 

                    if (__nrResponseJson.data.actor.entitySearch.results.entities !== undefined) { 

                        for (var j = 0; j < __nrResponseJson.data.actor.entitySearch.results.entities.length; j++) {

                            __entityUpdatePayload = await reconcileEntity(_config.ci_types[i], __nrResponseJson.data.actor.entitySearch.results.entities[j], __cis);

                            if (__entityUpdatePayload.found) {

                                __entityUpdateResponse = await updateEntity(_config, __entityUpdatePayload);
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

            } //try
            catch(_err) {

                __cursorId = null;
                __followCursor = false;
                console.error("Problem resolving Entity details: ", _err);
            } //catch

        } //while

    } //for

    console.log("Cycle Complete");
} // cycleSync

module.exports = {
    cycleSync: cycleSync
};