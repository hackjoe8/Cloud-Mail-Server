import assert from 'node:assert/strict';
import userService, { __userServiceTestHooks } from '../src/service/user-service.js';
import roleService from '../src/service/role-service.js';
import settingService from '../src/service/setting-service.js';

async function main() {
	const values = new Set();

	for (let i = 0; i < 100; i++) {
		const localPart = __userServiceTestHooks.randomHumanLocalPart();
		assert.match(localPart, /^[a-z]+[0-9]{8}[a-z0-9]{4}$/);
		values.add(localPart);
	}

	assert.equal(values.size, 100);

	const originalSelectById = roleService.selectById;
	const originalQuery = settingService.query;
	const originalGenerateUniqueEmails = userService.generateUniqueEmails;
	const originalAdd = userService.add;
	const capturedUsers = [];

	try {
		roleService.selectById = async () => ({ roleId: 1 });
		settingService.query = async () => ({ batchUserDefaultPassword: 'qq5718423' });
		userService.generateUniqueEmails = async () => ['alpha@example.com', 'beta@example.com'];
		userService.add = async (c, params) => capturedUsers.push(params);

		const createdUsers = await userService.batchCreateGeneratedUsers({}, { count: 2, suffix: 'example.com', type: 1 });

		assert.deepEqual(createdUsers, [
			{ email: 'alpha@example.com' },
			{ email: 'beta@example.com' }
		]);
		assert.deepEqual(capturedUsers.map(item => item.password), ['qq5718423', 'qq5718423']);
	} finally {
		roleService.selectById = originalSelectById;
		settingService.query = originalQuery;
		userService.generateUniqueEmails = originalGenerateUniqueEmails;
		userService.add = originalAdd;
	}

	console.log('user batch generate tests passed');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
