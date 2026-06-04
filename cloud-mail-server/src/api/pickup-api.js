import app from '../hono/hono';
import result from '../model/result';
import pickupService from '../service/pickup-service';

app.post('/pickup/link', async (c) => {
	const data = await pickupService.generateLink(c, await c.req.json());
	return c.json(result.ok(data));
});

app.post('/pickup/batchLinks', async (c) => {
	const data = await pickupService.batchGenerateLinks(c, await c.req.json());
	return c.json(result.ok(data));
});

app.get('/pickup-public/:token/list', async (c) => {
	const data = await pickupService.list(c, c.req.param('token'), c.req.query());
	return c.json(result.ok(data));
});
