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

    app.get('/', (req, res) => res.send('CMDB ENTITY SYNC'));

    // execute the daily run of the entity sync for each entity type/domain
    cron.schedule("0 " +  _start.config.daily_sync_time + " * * *", function() {

        console.log("Running cron cycle");
        cycleSync(_start.config).then(_result => {
          console.log(_result)
        });
    });

    // start http listener
    app.listen(config.express_port);
  } //if
  else if (_start.type === "single-run") {

    cycleSync(_start.config).then(_result => {
      console.log(_result)
    });
  } //if
  else if (_start.type === "encrypt") {

    encryptConfig(_start.config, _start.passphrase).then(_result => { 
      if (_result) {
        console.log("Config file successfully encrypted.");
      } //if
      else {
        console.log("Problem encrypting config file, see output for details.");
      }
    });
  } //if
  else {
  
    console.log("Invalid startup configuration: " + _start.message);
  } //else
});