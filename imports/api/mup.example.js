module.exports = {
  servers: {
    one: {
      // TODO: insert your droplet's IP address below into host:
      host: '',
      username: 'root',
      // pem:
      // TODO: insert your droplet's root password below:
      password: ''
      // or leave blank for authenticate from ssh-agent
    }
  },

  meteor: {
    name: 'app',
    path: '../',
    servers: {
      one: {}
    },
    buildOptions: {
      serverOnly: true,
    },
    env: {
      // ROOT_URL: 'app.com',
      MONGO_URL: 'mongodb://localhost/meteor'
    },

    dockerImage: 'abernix/meteord:base',
    deployCheckWaitTime: 60
  },

  mongo: {
    oplog: true,
    port: 27017,
    servers: {
      one: {},
    },
  },
};