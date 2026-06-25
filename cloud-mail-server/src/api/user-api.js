import app from '../hono/hono';
import userService from '../service/user-service';
import result from '../model/result';
import userContext from '../security/user-context';
import accountService from '../service/account-service';
import pickupService, { formatPickupText } from '../service/pickup-service';
import BizError from '../error/biz-error';

app.delete('/user/delete', async (c) => {
	await userService.physicsDelete(c, c.req.query());
	return c.json(result.ok());
});

app.put('/user/setPwd', async (c) => {
	await userService.setPwd(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/setStatus', async (c) => {
	await userService.setStatus(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/setType', async (c) => {
	await userService.setType(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/user/list', async (c) => {
	const data = await userService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/user/add', async (c) => {
	await userService.add(c, await c.req.json());
	return c.json(result.ok());
});

app.post('/user/batchCreatePickupLinks', async (c) => {
	if (c.get('user')?.email !== c.env.admin) {
		throw new BizError('Only admin can batch create pickup URLs', 403);
	}

	const params = await c.req.json();
	const createdList = await userService.batchCreateGeneratedUsers(c, params);
	const list = [];

	for (const item of createdList) {
		const pickup = await pickupService.generateLink(c, {
			email: item.email,
			expiresInSeconds: params.expiresInSeconds
		});
		list.push(pickup);
	}

	return c.json(result.ok({
		list,
		text: formatPickupText(list, params.outputMode, params.outputMode !== 'latest-body')
	}));
});

app.put('/user/resetSendCount', async (c) => {
	await userService.resetSendCount(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/restore', async (c) => {
	await userService.restore(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/user/allAccount', async (c) => {
	const data = await accountService.allAccount(c, c.req.query());
	return c.json(result.ok(data));
});

app.delete('/user/deleteAccount', async (c) => {
	await accountService.physicsDelete(c, c.req.query());
	return c.json(result.ok());
});


