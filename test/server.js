import http from 'http';
import express from 'express';
import Bluebird from 'bluebird';
import bodyParser from 'body-parser';

const app = express();
const server = http.createServer(app);
const events = [];

app.use(bodyParser.json());

app.get('/events', (req, res) => {
	res.json(events);
	events.length = 0;
});

app.use('/:v/:id/event', (req, res) => {
	const { body } = req;
	const { authorization } = req.headers;
	if (authorization.indexOf(process.env.BITCLOCK_TOKEN) === -1) {
		res.status(500);
		res.json({ message: 'missing token' });
	} else {
		const array = Array.isArray(body) ? body : [body];
		events.push(...array);
		res.json({ success: true });
	}
});

export function start() {
	return Bluebird
		.fromCallback(cb => server.listen(3000, cb));
}

export function stop() {
	events.length = 0;
	server.close();
}
