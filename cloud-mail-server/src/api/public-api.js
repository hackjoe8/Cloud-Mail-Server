import app from '../hono/hono';
import result from '../model/result';
import publicService from '../service/public-service';
import pickupService from '../service/pickup-service';

app.post('/public/genToken', async (c) => {
	const data = await publicService.genToken(c, await c.req.json());
	return c.json(result.ok(data));
});

app.post('/public/emailList', async (c) => {
	const list = await publicService.emailList(c, await c.req.json());
	return c.json(result.ok(list));
});

app.post('/public/addUser', async (c) => {
	const params = await c.req.json();
	const data = await publicService.addUser(c, params);
	const list = [];

	for (const item of data.list) {
		const pickup = await pickupService.generatePublicLink(c, {
			email: item.email,
			expiresInSeconds: params.expiresInSeconds
		});
		list.push(pickup);
	}

	return c.json(result.ok({
		list,
		text: list.map(item => `${item.email}----${item.url}`).join('\n')
	}));
});

app.post('/public/pickup/link', async (c) => {
	const data = await pickupService.generatePublicLink(c, await c.req.json());
	return c.json(result.ok(data));
});
