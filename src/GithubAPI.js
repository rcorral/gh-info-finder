import _ from 'lodash';
import request from 'request';
let debug = require('debug')('debug')

class GithubAPI {
  constructor (token) {
    this.token = token;
    this.bindFunctions();
  }

  bindFunctions() {
    ['request', 'getUserProfile', 'getUserRepositories', 'getCommitsForRepo']
      .forEach(function (key) {
      if (typeof this[key] === 'function') {
        this[key] = this[key].bind(this);
      }
    }, this);
  }

  request(path, options) {
    var options = _.extend({
      headers: {
        'Authorization': `token ${this.token}`,
        'User-Agent': 'Mesosphere hunt'
      },
      json: true,
      method: 'GET',
      uri: `https://api.github.com${path}`
    }, options);

    return new Promise (function (resolve, reject) {
      request(options, function (error, response, body) {
        if (error || response.statusCode !== 200) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    });
  }

  getUserProfile(user) {
    return this.request(`/users/${user}`);
  }

  getUserRepositories(user) {
    return this.request(`/users/${user}/repos?sort=updated`);
  }

  getCommitsForRepo(repo, options = {}) {
    let url = `/repos/${repo}/commits`;

    if (options.author) {
      url += `?author=${options.author}`;
    }

    return this.request(url);
  }

}

export default GithubAPI;
