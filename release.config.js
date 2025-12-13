export default {
	branches: ["main"],
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/npm",
		[
			"@semantic-release/exec",
			{
				prepareCmd:
					"node -e \"const fs = require('fs'); let c = fs.readFileSync('.env', 'utf8'); c = c.replace(/APP_VERSION=.*/g, 'APP_VERSION=${nextRelease.version}'); fs.writeFileSync('.env', c);\"",
			},
		],
		"@semantic-release/github",
		[
			"@semantic-release/git",
			{
				assets: ["package.json", ".env"],
				message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
			},
		],
	],
};
