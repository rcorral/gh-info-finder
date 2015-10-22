import _ from 'lodash';
import config from './configuration';
import stdin from './stdin';
import GithubAPI from './GithubAPI';
let debug = require('debug')('debug')
let csv = require('to-csv');

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
    return new Promise((resolve, reject) => {
      userList.forEach((user) => {
        this.api.getUserProfile(user)
          .then((profile) => {
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

      let storeEmail = (username, email) => {
        this.users[username].emails.push(email);
        tick();
      }

      let storeEmails = (username, emails) => {
        this.users[username].emails = emails;
        tick();
      }

      let tick = () => {
        usersWithFoundEmails++;
        debug(`hunting: ${usersWithFoundEmails}/${totalUsers}`);

        if (usersWithFoundEmails === totalUsers) {
          resolve();
        }
      }

      Object.keys(this.users).forEach((username) => {
        let user = this.users[username];

        if (user.profile.email) {
          storeEmail(username, {
            email: user.profile.email,
            meta: {
              rank: 1,
              source: 'profile',
              name: user.profile.name
            }
          });
        } else {
          // Search for users repositories
          this.api.getUserRepositories(username)
            .then(this.getCommitsForRepositories(username))
            .then(this.huntForEmailInCommits.bind(this))
            .then(function (emails) {
              storeEmails(username, emails);
            });
        }
      });
    });
  }

  getCommitsForRepositories(username) {
    // Use a closure to store what username we're targeting
    return (repositories) => {
      return new Promise((resolve, reject) => {
        let data = {};

        repositories.forEach((repo) => {
          this.api.getCommitsForRepo(repo.full_name, {author: username})
            .then(function (commits) {
              data[repo.full_name] = commits;

              let dataLength = Object.keys(data).length;
              debug(`commits: ${dataLength}/${repositories.length}`);

              // Resolve once we got all we need
              if (Object.keys(data).length === repositories.length) {
                resolve(data);
              }
            });
        });
      });
    }
  }

  huntForEmailInCommits(repos) {
    return new Promise((resolve, reject) => {
      let emailsFound = {}; // Hashmap for easy lookups
      let emailsData = [];

      Object.keys(repos).forEach((repo) => {
        // A datum is a commit for the given repo
        repos[repo].forEach((datum) => {
          let commit = datum.commit;
          let committer = datum.committer;

          if (commit.committer &&
            commit.committer.email &&
            this.users[committer.login] &&
            emailsFound[commit.committer.email] == null
          ) {
            emailsFound[commit.committer.email] = true;
            emailsData.push({
              email: commit.committer.email,
              meta: {
                rank: 3,
                source: repo,
                name: commit.committer.name
              }
            });
          }
        });
      });

      resolve(emailsData);
    });
  }

  printResults() {
    let maxEmails = 5;
    let data = [];

    Object.keys(this.users).forEach((username) => {
      let user = this.users[username];

      let datum = {
        username,
        name: user.profile.name,
        company: user.profile.company,
        website: user.profile.blog,
        location: user.profile.location,
        hireable: user.profile.hireable,
        github: user.profile.html_url
      };

      user.emails.forEach(function (email, i) {
        if (i >= maxEmails) {
          return;
        }

        datum[`email${i}`] = email.email;
        datum[`email${i}_source`] = email.source;
        datum[`email${i}_name`] = email.name;
      });

      data.push(datum);
    });

    let fields = [
      {name: 'username', label: 'username', quoted: true},
      {name: 'name', label: 'Name', quoted: true},
      {name: 'company', label: 'Company', quoted: true},
      {name: 'website', label: 'Website'},
      {name: 'location', label: 'Location', quoted: true},
      {name: 'hireable', label: 'Hireable'},
      {name: 'github', label: 'Github'}
    ];

    for (var i = 0; i < maxEmails; i++) {
      fields.push({name: `email${i}`, label: `Email ${i}`});
      fields.push({name: `email${i}_source`, label: `Email ${i} Source`});
      fields.push({name: `email${i}_name`, label: `Email ${i} Name`});
    };

    console.log(csv(data));
  }

  run() {
    this.requestUrls()
      .then(this.getUserListFromUrls.bind(this))
      .then(this.getUserProfiles.bind(this))
      .then(this.goHunting.bind(this))
      .then(this.printResults.bind(this));
  }
}

let app = new Application(config);
app.run();
