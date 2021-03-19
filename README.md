[![New Relic Experimental header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Experimental.png)](https://opensource.newrelic.com/oss-category/#new-relic-experimental)

# New Relic Entity CMDB CI Sync

This project provides a set of opinionated mechanisms to synchronize Entity tags in New Relic with other sources of entity metadata. While initially conceived to synchronize CI attributes from ServiceNow CMDB, the scripts are intended to be modularized to provide metadata synchronization with other systems of record.

## How does it work?

The synchronization process works as follows:
- The process configuration provides a link between a set of _provider_ entries and a set of New Relic Entities.
- The process loops over the New Relic Entity Set and attempts to resolve the current entity with a match from the _provider_ using a predefined matching strategy.
- If a match is discovered the attributes denoted in the configuration for the provider are applied to the New Relic Entity as tags (key and value).  

## How is it deployed?

At present the process is deployed as a standalone service. It is the intention of this project to provide the capability as:
- a standalone service
- a containerized service (under development)
- a serverless function (under development)
- a New Relic Synthetic (under development)

## Configuration

Configuration of the service is limited to command line parameters and the comprehensive config file. Options for both sources are outlined below.

### Config file format
The ```config.json``` file that is used to configure the synchronization service is divided into 3 main sections (ci_types array, provider object, and core configuration parameters).

**Core Configuration**

```javascript
"nrdb_insert_api_key": "NRII-########################",
"nrdb_insert_url": "https://insights-collector.newrelic.com/v1/accounts/#######/events",
"nrdb_entitysync_event_name": "SNOW_ENTITY_SYNC",
"nr_graph_api_key": "NRAK-###################",
"nr_graph_api_account": "########",
"daily_sync_time": "3",
"express_port": "7373",
"encrypted_config": false,
"version": "4",
```
- _nrdb_insert_api_key_: The API key used to insert New Relic NRDB events.
- _nrdb_insert_url_: The New Relic NRDB insert URL, please update to reflect the account ID where insert events are to be written.
- _nrdb_entitysync_event_name_: The event name for the entity sync housekeeping events.  
- _nr_graph_api_key_: The API key used to query New Relic Entities via the [graph api](https://api.newrelic.com/graphiql?#query=)
- _nr_graph_api_account_: The account number where entity sync events are being written. The graph api key must have access read from this account.
- _daily_sync_time_: The time of day GMT the synchronization process executes.
- _express_port_: The port the service based deployment uses to communicate in http.
- _encrypted_config_: (true|false) Whether the config file includes encrypted values.
- _version_: specifies the current version of this config document.

**Provider Object**

```javascript
"provider" : {
    "type": "servicenow",
    "api_url": "https://###########.service-now.com/",
    "api_key": "#######################",
    "api_uname": "#######",
    "api_pword": "#######"
}
```
- _provider_: The encapsulating object for provider information (i.e. where this services goes to get the prospective Entity information).
- _type_: Used to determine the access and conditional formatting logic for the provider calls. Possible options include (servicenow,)
- _api_url_: The root api url of the provider.
- _api_key_: The api token or key used for api calls (where applicable).
- _api_uname_: The username for API access (where applicable).
- _api_pword_: The password for API access (where applicable).

**Proxy Object**
```javascript
"proxy": {
    "enabled": false,
    "address": "http://192.168.99.100:8080"
}
```
- _proxy_: The encapsulating object for the proxy/network settings.
- _enabled_: (true|false)
- _address_: The full address to the proxy, including port and basic auth if needed.

**CI Types Array**

```javascript
"ci_types": [{
    "type": "cmdb_ci_app_server",
    "key": "name",
    "api": "/api/now/table/cmdb_ci_app_server",
    "api_query_parms": "?sysparm_fields=software_install%2Cmac_address%2Cowned_by%2Cattributes%2Ccorrelation_id%2Ccost_center%2Cu_recovery_plan_name%2Csys_id%2Csys_tags%2Csys_class_name%2Cname%2Csupported_by%2Csubcategory%2Cassignment_group%2Ccategory%2Cip_address%2Casset_tag%2Crunning_process%2Crunning_process_key_parameters%2Crp_command_hash",
    "api_page_size": 10000,
    "api_method": "GET",
    "tags": [
        "sys_class_name",
        "sys_id",
        "support_group.value"
    ],
    "nr_entity_domain": "APM",
    "nr_entity_type": "APPLICATION",
    "nr_entity_key": {
        "type": "attribute",
        "key": "name",
        "strategy": "caseless_match"
    },
    "nr_entity_update": false,
    "nr_entity_tag_key": {
        "sys_class_name": "SNOW_CI_CLASS",
        "sys_id": "SNOW_CMDB_CI",
        "support_group.value": "SNOW_SUPPORT_GROUP"
    }
}, ... ]
```
- _ci_types_: An array of ci_type objects. These objects define the details of the API calls to the provider system, and match those details to a New Relic Entity Search API call.
- _type_:
- _key_: The value from the provider entry that will be used for the resolution strategy.
- _api_: The api path.
- _api_query_parms_: The API query string. The query parms string supports the substitution of ```${sys_updated_on}``` for use when passing the query param ```sys_updated_on>javascript:gs.dateGenerate(${sys_updated_on})``` when seeking to query CIs updated since the last run of the sync tool.
- _api_page_size_: The sysparm_limit and sysparm_offset values used during collection of CIs. For example, if set to 5 and there are 20 CIs to return, there will be 4 separate pages retrieved from CMDB (0-5, 5-10, 10-15, 15-20). Defaults to 10,000.
- _api_method_: The http method (GET|POST)
- _tags_: The attributes or tags on the provider entry that will be added to the New Relic Entity. Tags support nested objects from the provider to one level of depth. Use dot notion like ```support_group.value``` to access the values of nested objects.
- _nr_entity_domain_: The New Relic Entity domain used for GraphQL entity search (APM | BROWSER | INFRA | SYNTH | MOBILE)
- _nr_entity_type_: The New Relic Entity type used for GraphQL entity search (APPLICATION | DASHBOARD | HOST | MONITOR | WORKLOAD)
- _nr_entity_key_: An object that encapsulates the information needed to map metadaat from a New Relic Entity to a _provider_ source.
- _nr_entity_key.type_: What type of Entity metadata will we use to reconcile the CI (attribute | tag). If _attribute_ is selected, the following _nr_entity_key.key_ value is limited to direct attributes of the Entity such as (name | accountId | guid). If _tag_ is selected the _nr_entity_key.key_ can be any value that matches a tag key possessed by the target Entity.
- _nr_entity_key.key_: The New Relic Entity attribute that will be used to execute the resolution strategy.
- _nr_entity_key.strategy_: How the Entity and _Provider_ key values are to be compared (caseless_match|exact_match|exact_contains|caseless_contains).
- _nr_entity_update_: (true|false) Whether to update the Entity discovered if the Entity tag alread exists. False ignores the update if the tag exists, true updates no matter the value specified.  
- _nr_entity_tag_key_: The New Relic Entity key value (name) for the _provider_ attribute value.

### Config file encryption

To encrypt sensitive fields in the config.json, execute the following proceedure:
- Create your config.json with all values in clear text
- From the commandline run ```node ./js/index.js encrypt <my_awesome_passphrase>```
- The command above will set ```encrypted_config: true``` use the passphrase for a one way AES encruption of the following config values:
  - ```provider.api_key```
  - ```provider.api_uname```
  - ```provider.api_pword```
  - ```nrdb_insert_api_key```
  - ```nrdb_insert_url```
  - ```nr_graph_api_key```
  - ```nr_graph_api_account```
  - ```proxy.address```
- The file will be written as ```enc.config.json``` in the config directory of the utility. (note: encryption is unrecoverable, a passphrase will be needed to run the service using the encrypted config.json)
- This new file with encrypted values needs to be moved / copied into ```config.json```
- When invoking the utility subsequently accompany the commandline option with the passphase for the encrypted config (e.g. ```node ./js/index.js single-run <my_awesome_passphrase>```)

### Logging

The logs section determines the location, size and max number of logs for the process. 

```javascript
"logs": {
    "filename": "cmdb-sync.log",
    "level": "info",
    "max_size": "20m",
    "max_files": "7d"
}
```
- _filename_: The name (location) of the log output file. Default location is in the root diretcory.
- _level_: one of (error | warn | info | http | verbose | debug | silly)
- _max_size_: Maximum size of the file after which it will rotate. This can be a number of bytes, or units of kb, mb, and gb. If using the units, add 'k', 'm', or 'g' as the suffix. The units need to directly follow the number.
- _max_files_: Maximum number of logs to keep. If not set, no logs will be removed. This can be a number of files or number of days. If using days, add 'd' as the suffix.

### ServiceNow specific config

Please see CI Types and Provider section for details. ServiceNow is the only supported CMDB at present.

### Command line parameters

The service deployment options expect a parameter of either "server" or "single-run" as the main runtime entry.
- server: initializes the service as a web application and executes the synchronization process based on the ```"daily_sync_time": "3"``` configuration parameter.
- single-run: executes the synchronization process immediately and terminates the application.

## Deployment

### Standalone service
- Ensure [npm](https://www.npmjs.com/) and [node](https://nodejs.org/) are installed on your system
- Download the .zip archive or clone the repo
- From the root directory chmod ```install.sh``` and ```run.sh``` to be executable in your shell
- Execute ```install.sh``` to install the dependent libraries
- Edit the ./js/config.json file and add all needed values described in the config section of this readme
- Edit the ./js/newrelic.js file to include your New Relic license key _(not a requirement but a best practice)_
- Edit the ```run.sh``` pass the "server" parameter to the application, by default the service runs once
- Execute the ```run.sh``` and sync some CI/Entity metadata!
* NOTE: Invoking the runtime with the script is not the preferred method for an encrypted config invocation, as the passphrase needs to be passed to the runtime in invocation.   

### Containerized service

### Serverless function

## Operation

### Expected behavior

### Audit reporting

## Support

New Relic has open-sourced this project. This project is provided AS-IS WITHOUT WARRANTY OR DEDICATED SUPPORT. Issues and contributions should be reported to the project here on GitHub.

We encourage you to bring your experiences and questions to the [Explorers Hub](https://discuss.newrelic.com) where our community members collaborate on solutions and new ideas.

Please open issues [in this repo](https://github.com/newrelic-experimental/newrelic-entity-cmdb-ci-sync/issues) for bugs or enhancements.  

## Contributing

We encourage your contributions to improve Salesforce Commerce Cloud for New Relic Browser! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project. If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company, please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

## License

newrelic-entity-cmdb-ci-sync is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
