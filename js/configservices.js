async function encryptConfig(_config, _passphrase) {
    
    const fs = require('fs');
    var __rc = true;
    var __encrypt = require("./aaa/utilities").encryptString;
    
    // encrypt provider specific config options 
    if (_config.provider.type === "servicenow") {

        _config.provider.api_key = await __encrypt(_config.provider.api_key, _passphrase);
        _config.provider.api_uname = await __encrypt(_config.provider.api_uname, _passphrase);
        _config.provider.api_pword = await __encrypt(_config.provider.api_pword, _passphrase);
    } //if

    // encrypt common config options
    _config.nrdb_insert_api_key = await __encrypt(_config.nrdb_insert_api_key, _passphrase);
    _config.nrdb_insert_url = await __encrypt(_config.nrdb_insert_url, _passphrase);
    _config.nr_graph_api_key = await __encrypt(_config.nr_graph_api_key, _passphrase);
    _config.nr_graph_api_account = await __encrypt(_config.nr_graph_api_account, _passphrase);
    _config.proxy.address = await __encrypt(_config.proxy.address, _passphrase);
    _config.encrypted_config = true;

    fs.writeFile('./config/enc.config.json', JSON.stringify(_config), _err => {
        if (_err) {
            console.log('Error writing config file', _err);
            __rc = false;
        } //if
         else {
            console.log('Successfully wrote config file: enc.config.json')
        } //else
    });

    return(__rc);
} //encryptConfig

async function decryptConfig(_config, _passphrase) {

    var __decrypt = require("./aaa/utilities").decryptString;
    
    // decrypt provider specific config options 
    if (_config.provider.type === "servicenow") {

        _config.provider.api_key = await __decrypt(_config.provider.api_key, _passphrase);
        _config.provider.api_uname = await __decrypt(_config.provider.api_uname, _passphrase);
        _config.provider.api_pword = await __decrypt(_config.provider.api_pword, _passphrase);
    } //if

    // decrypt common config options
    _config.nrdb_insert_api_key = await __decrypt(_config.nrdb_insert_api_key, _passphrase);
    _config.nrdb_insert_api_key = await __decrypt(_config.nrdb_insert_api_key, _passphrase);
    _config.nrdb_insert_url = await __decrypt(_config.nrdb_insert_url, _passphrase);
    _config.nr_graph_api_key = await __decrypt(_config.nr_graph_api_key, _passphrase);
    _config.nr_graph_api_account = await __decrypt(_config.nr_graph_api_account, _passphrase);
    _config.proxy.address = await __decrypt(_config.proxy.address, _passphrase);
    _config.encrypted_config = false;

    return(_config);
} //decryptConfig

//TODO Implement a testing function for the config
async function testConfig(_config) {

    return(true);
} //testConfig

async function startupHandler(_args, _config) {

    var __startUpObj = {};

    if (_args.length > 0) {

        // handle _passphrase encryption
        if (_args.length > 1) {
        
            if (_config.encrypted_config) {

                __startUpObj.config = await decryptConfig(_config, _args[1]);
            } //if
            else {
                __startUpObj.config = _config;
            } //else

            __startUpObj.passphrase = _args[1];
        } //if
        else {
            __startUpObj.config = _config;
        } //else

        if (_args[0] === "server") {

            __startUpObj.type = "server";
            __startUpObj.message = "Server startup config appears nominal."
        } //if
        else if (_args[0] === "single-run") {
            __startUpObj.type = "single-run";
            __startUpObj.message = "Single run startup config appears nominal."
        } //else if
        else if (_args[0] === "encrypt" && _args.length > 1) {
            __startUpObj.type = "encrypt";
            __startUpObj.message = "Encryption startup config appears nominal."
        } //else if
        else {
            __startUpObj.type = "UNSUPORTED";
            __startUpObj.message = "Unrecognized commandline parameters passed to startup."
        }
    } //if
    else {

        __startUpObj.type = "UNSUPORTED";
        __startUpObj.message = "No commandline parameters passed to startup."
    } //else

    return(__startUpObj);
} //startupHandler

module.exports = {
    encryptConfig: encryptConfig,
    startupHandler: startupHandler
};