// Runs SimpleGit against the fake GitHub so you can click around without a
// real GitHub account:  node test/demo.js   then open http://localhost:3000
import { startAll } from './harness.js';

const env = await startAll({ simplegitPort: Number(process.env.PORT || 3000) });
console.log(`SimpleGit demo (fake GitHub data) is running at ${env.appUrl}`);
