//require('newrelic');
const cron = require("node-cron");
const express = require("express");
const config_file = require('../config/config.json');
let cycleSync = require("./entitysync").cycleSync;
let encryptConfig = require("./configservices").encryptConfig;
let startup = require("./configservices").startupHandler;
let args = process.argv.slice(2);
let app = express();

startup(args, config_file).then(_start =>{

  if (_start.type === "server") {

    app.get('/', (req, res) => {
      _start.logger.info(JSON.stringify(req));
      res.send('CMDB ENTITY SYNC');
    });

    // execute the daily run of the entity sync for each entity type/domain
    cron.schedule("0 " +  _start.config.daily_sync_time + " * * *", function() {

        _start.logger.info("[ index::startup ] Running cron cycle");
        cycleSync(_start.config, _start.logger).then(_result => {
          _start.logger.info(_result)
        });
    });

    // start http listener
    app.listen(_start.config.express_port);
  } //if
  else if (_start.type === "single-run") {

    _start.logger.info("[ index::startup ] Starting single-run of newrelic-entity-cmdb-sync.");
    cycleSync(_start.config, _start.logger).then(_result => {
    _start.logger.info(_result);
    });
  } //if
  else if (_start.type === "encrypt") {

    encryptConfig(_start.config, _start.logger, _start.passphrase).then(_result => { 
      if (_result) {
        _start.logger.info("[ index::startup ] Config file successfully encrypted.");
      } //if
      else {
        _start.logger.info("[ index::startup ] Problem encrypting config file, see output for details.");
      }
    });
  } //if
  else {
  
    _start.logger.info("[ index::startup ] Invalid startup configuration: " + _start.message);
  } //else
});