module.exports = (function() {
    axios = require('axios');

    const url = 'http://' + process.env.LOGSTASH_URL;

    const log = (level, type, data) => {
        console.log(`DBG logging: ${level}, ${type}, ${data}`)
        axios.post(url, {
            "@timestamp": new Date().toISOString(),
            level: level,
            type: type,
            data: data
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        }).catch(err => console.warn(`Could not send message to Logstash: ${err.message}`))
    };

    return () => ({
        info:  (type, data) => log('info',  type, data),
        warn:  (type, data) => log('warn',  type, data),
        error: (type, data) => log('error', type, data)
    });
})()
