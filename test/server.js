import _ from 'lodash';
import http from 'http';
import express from 'express';
import Bluebird from 'bluebird';
import bodyParser from 'body-parser';
import timeout from 'connect-timeout';

const app = express();
const server = http.createServer(app);
const events = [];

app.use(bodyParser.json());

app.use(timeout(500));

app.get('/events', (req, res) => {
	res.json(events);
	events.length = 0;
});

app.use('/:v/bucket/:id/event', (req, res, next) => {
	const { body } = req;
	const { authorization } = req.headers;
	if (authorization.indexOf(process.env.BITCLOCK_TOKEN) === -1) {
		next(new Error('missing token'));
	} else if (_.get(body, ['events', 0, 'type']) === 'timeout') {
		// do nothing and let the request timeout
	} else {
		const { events: chunk } = body;
		events.push(...chunk);
		res.json({ chunk, total: events.length });
	}
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
	res.status(500);
	res.json({ err });
});

export function startServer(port = 3000) {
	return Bluebird
		.fromCallback(cb => server.listen(port, cb));
}

export function stopServer() {
	events.length = 0;
	server.close();
}
