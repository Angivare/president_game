`docker-compose up` to run

Containers take ~1mn to be ready

Application is exposed on `http://localhost:3000/`

Actions done in the game (connection, room creation, ..) are logged in elasticsearch (via logstash)

To access these logs, access the Kibana interface on `http://localhost:3100/app/kibana#/discover`
Then create an index pattern matching `logstash*` and using `@timestamp` as time index
