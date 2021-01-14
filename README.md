[![New Relic Experimental header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Experimental.png)](https://opensource.newrelic.com/oss-category/#new-relic-experimental)

# New Relic Entity CMDB CI Sync [build badges go here when available]

This project provides a set of opinionated mechanisms to synchronize Entity tags in New Relic with other sources of entity metadata. While initially conceived to synchronize CI attributes from ServiceNow CMDB, the scripts are intended to be modularized to provide metadata synchronization with other systems of record. 

## How does it work?

The synchronization process works as follows:
- The process configuration provides a link between a set of _provider_ entries and a set of New Relic Entities. 
- The process loops over the New Relic Entity Set and attempts to resolve the current entity with a match from the _provider_ using a predefined matching strategy. 
- If a match is discovered the attributes denoted in the configuration for the provider are applied to the New Relic Entity as tags (key and value).  

## How is it deployed?

At present the process is deployed as a standalone service. It is the intention of this project to provide the capability as:
- a standalone service
- a containerized service (tbd)
- a serverless function (tbd)
- a New Relic Synthetic (tbd)

## Configuration

Configuration of the service is limited to command line parameters and the comprehensive config file. Options for both sources are outlined below. 

### Config file format



### ServiceNow specific config

### Command line parameters

The service deployment options expect a paramter of either "server" or "single-run" as the main runtime entry. 
- server: initalizes the service as a web application and executes the synchronization process based on the ```"daily_sync_time": "3"``` configuration parameter
- single-run: executes the synchronization process immediately and terminates the application


## Deployment

### Standalone service

### Containerized service

### Serverless function

### New Relic Synthetic

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

