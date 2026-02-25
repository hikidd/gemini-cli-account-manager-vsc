import { runGeminiCliServiceTests } from './geminiCliService.test';

async function run(): Promise<void> {
  await runGeminiCliServiceTests();
  console.log('All tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
