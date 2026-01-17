import { createRepository, getAuthenticatedUser } from '../server/github';

async function main() {
  try {
    const user = await getAuthenticatedUser();
    console.log('GitHub user:', user.login);
    
    const repo = await createRepository('agentic-dynamic-pricing', 'AI-driven dynamic pricing simulator for airline ticketing using multi-agent architecture with Google Gemini', false);
    console.log('Repository created:', repo.html_url);
    console.log('Clone URL:', repo.clone_url);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();
