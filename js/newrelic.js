'use strict'
/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: ['NR_UTILS_CMDB_SYNC'],
  /**
   * Your New Relic license key.
   */
  license_key: 'LICENSE HERE PLEASE',
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosin
g
     * issues with the agent, 'info' and higher will impose the least overhead o
n
     * production applications.
     */
    level: 'info'
  },
  /**
   * When true, all request headers except for those listed in attributes.exclud
e
   * will be captured for all traces, unless otherwise specified in a destinatio
n's
   * attributes include/exclude lists.
   */
  allow_all_headers: true,
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildca
rd
     * at end.
     *
     * NOTE: If excluding headers, they must be in camelCase form to be filtered
.
     *
     * @env NEW_RELIC_ATTRIBUTES_EXCLUDE
     */
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  }
}