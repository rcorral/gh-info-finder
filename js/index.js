var Application = (function () {
  var Application = function () {
    this.el = document.querySelector('[name=githubs]');
    this.tableEl = document.querySelector('.table');
    this.addEventListeners();
  };

  Application.prototype.addEventListeners = function() {
    var el = document.querySelector('[name=submit]');
    el.addEventListener('click', this.handleSubmit.bind(this));
  };

  Application.prototype.handleSubmit = function() {
    this.userData = [];
    var urls = this.el.value.split("\n");

    var users = urls.map(function(url){
      return url.replace(/https:\/\/github.com\//, '');
    });

    this.getUsersInfo(users)
    .then(this.displayInfo.bind(this));
  };

  Application.prototype.getUsersInfo = function(users) {
    return new Promise(function(resolve, reject) {
      users.forEach(function(user, i) {
        this.requestUserData(user)
        .then(this.saveUserData.bind(this))
        .then(function() {
          if (i === users.length - 1) {
            resolve(this.userData);
          }
        }.bind(this));
      }, this);
    }.bind(this));
  };

  Application.prototype.requestUserData = function(user) {
    return qwest.get(`https://api.github.com/users/${user}`, {
      headers: {
        'Authorization': 'token x'
      }
    });
  };

  Application.prototype.saveUserData = function(data) {
    this.userData.push(data);
    return Promise.resolve();
  };

  Application.prototype.displayInfo = function(users) {
    var tbody = this.tableEl.querySelector('tbody');
    tbody.innerHTML = '';

    if (users.length) {
      this.tableEl.style.display = 'inline';
    } else {
      this.tableEl.style.display = 'none';
    }

    users.forEach(function(user) {
      var tr = document.createElement('tr');

      ['name', 'email', 'company', 'blog', 'html_url'].forEach(function(key) {
        var td = document.createElement('td');

        if (['blog', 'html_url'].indexOf(key) !== -1) {
          td.innerHTML = `<a href="${user[key]}">${user[key]}</a>`;
        } else {
          td.textContent = user[key];
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  };

  return Application;
})();

window.onload = function () {
  (new Application());
}
