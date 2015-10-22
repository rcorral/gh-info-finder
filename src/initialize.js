import _ from 'lodash';
import config from './configuration';
import stdin from './stdin';
import GithubAPI from './GithubAPI';
let debug = require('debug')('debug')

class Application {
  constructor(config) {
    this.api = new GithubAPI(config.token);
    this.users = {};
  }

  requestUrls() {
    return new Promise(function (resolve, reject) {
      let message = "Enter Github user urls ([enter] submits):\n";
      let data = `https://github.com/jwngr
https://github.com/brettwejrowski`;
      // stdin.read(message, function (data) {
        resolve(data);
      // });
    });
  }

  getUserListFromUrls(data) {
    return new Promise(function (resolve, reject) {
      let urls = data.split("\n");

      // Converts a list of urls to a list of users
      let users = urls.map(function(url) {
        return url.replace(/https:\/\/github.com\//, '').trim();
      });

      users = _.compact(users);

      debug('found users', users);
      resolve(users);
    });
  }

  /**
   * Build a hash of users with their profile
   */
  getUserProfiles(userList) {
    return new Promise(function (resolve, reject) {
      userList.forEach((user) => {

        this.api.getUserProfile(user)
          .then(function (profile) {
            this.users[user] = {
              profile,
              // Emails will be in this form
              // {email, meta: {source, rank, ...other}}
              // Where source is where it was found, email (obvious),
              // rank (ranks the source)
              emails: []
            };

            let totalProfiles = Object.keys(this.users).length;
            debug(`profiles: ${totalProfiles}/${userList.length}`);

            // Check if we've received all user profiles
            if (Object.keys(this.users).length === userList.length) {
              resolve();
            }
          });
      });
    });
  }

  /**
   * Does whatever it can to find a users email if it's not already
   * in their profile
   */
  goHunting() {
    return new Promise((resolve, reject) => {
      let usersWithFoundEmails = 0;
      let totalUsers = Object.keys(this.users).length;
      let storeEmail = (userName, email) => {
        this.users[userName].emails.push(email);
        usersWithFoundEmails++;
        debug(`hunting: ${usersWithFoundEmails}/${totalUsers}`);

        if (usersWithFoundEmails === this.users.length) {
          resolve();
        }
      }

      Object.keys(this.users).forEach((userName) => {
        let user = this.users[userName];

        if (user.profile.email) {
          storeEmail(userName, {
            email: user.profile.email,
            meta: {
              rank: 1,
              source: 'profile',
              name: user.profile.name
            }
          });
        } else {
          // Search for users repositories
          this.api.getUserRepositories(userName)
            .then(this.getCommitsForRepositories(userName))
            .then(this.huntForEmailInCommits.bind(this))
            .then(function () {
              emails.forEach(function (emailDatum) {
                storeEmail(userName, emailDatum);
              });
            });
        }
      });
    });
  }

  getCommitsForRepositories(username) {
    // Use a closure to store what username we're targeting
    return function (repositories) {
      return new Promise((resolve, reject) => {
        let data = {};

        repositories.forEach((repo) => {
          this.api.getCommitsForRepo(repo.full_name, {author: username})
            .then(function (commits) {
              data[repo.full_name] = commits;

              let dataLength = Object.keys(data).length;
              debug(`profiles: ${dataLength}/${repositories.length}`);

              // Resolve once we got all we need
              if (Object.keys(data).length === repositories.length) {
                resolve(data);
              }
            });
        });
      });
    }
  }

  huntForEmailInCommits(commits) {
    return new Promise((resolve, reject) => {
      let emailsData = [];
      Object.keys(commits).forEach((repo) => {
        let datum = commits[repo];
        let comit = datum.comit;
        let committer = datum.committer;

        if (commit.committer &&
          commit.committer.email &&
          this.users[committer.login]
        ) {
          emailsData.push({
            email: commit.committer.email,
            meta: {
              rank: 3,
              source: datum.html_url,
              name: commit.committer.name
            }
          });
        }
      });

      resolve(emailsData);
    });
  }

  run() {
    this.requestUrls()
      .then(this.getUserListFromUrls.bind(this))
      .then(this.getUserProfiles.bind(this))
      .then(this.goHunting.bind(this))
      .then(() => {
        console.log(this.users);
      });
  }
}

let app = new Application(config);
app.run();
