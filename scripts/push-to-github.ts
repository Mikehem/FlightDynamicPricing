import { createRepository, getAuthenticatedUser } from '../server/github';

async function main() {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    console.log(`Authenticated as: ${user.login}`);

    // Create repository
    const repoName = 'agentic-dynamic-pricing';
    const description = 'AI-powered dynamic pricing simulator for airline ticketing using multi-agent architecture with Gemini LLM';
    
    console.log(`Creating repository: ${repoName}...`);
    const repo = await createRepository(repoName, description, false);
    console.log(`Repository created: ${repo.html_url}`);
    console.log(`Clone URL: ${repo.clone_url}`);
    
    // Output the remote URL for git setup
    console.log('\n--- GIT REMOTE URL ---');
    console.log(repo.clone_url);
    
  } catch (error: any) {
    if (error.status === 422) {
      console.log('Repository may already exist. Checking...');
      const user = await getAuthenticatedUser();
      console.log(`Check: https://github.com/${user.login}/agentic-dynamic-pricing`);
    } else {
      console.error('Error:', error.message);
    }
  }
}

main();
