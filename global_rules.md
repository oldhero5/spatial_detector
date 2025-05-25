## Global Rules

- After making changes, ALWAYS make sure to start up a new server so I can test it.
- Always look for existing code to iterate on instead of creating new code.
- Do not drastically change the patterns before trying to iterate on existing patterns.
- Always kill all existing related servers that may have been created in previous testing before trying to start a new server.
- Always prefer simple solutions
- Always prefer to use existing code instead of writing new code
- Always use uv to install packages
- Always use uv to run scripts
- Always use uv to run tests
- Always use uv to run the server
- Always use uv to run the app
- Always clarify unknowns
- Always ask for clarification if you are unsure of something
- Always check that you are in line with the global rules
- Always check that you are in line with the task rules
- Always check that you are in line with the todo list
- Always use the expand.md to expand on the task rules
- Always update the memory.md file with any new information or changes
- Always update the todo.md file with any new information or changes
- Always update the tasks.md file with any new information or changes
- Always update the expand.md file with any new information or changes 
- Avoid duplication of code whenever possible, which means checking for other areas of the codebase that might already have similar code and functionality
- Write code that takes into account the different environments: dev, test, and prod
- You are careful to only make changes that are requested or you are confident are well understood and related to the change being requested
- When fixing an issue or bug, do not introduce a new pattern or technology without first exhausting all options for the existing implementation. And if you finally do this, make sure to remove the old implementation afterwards so we don't have duplicate logic.
- Keep the codebase very clean and organized
- Avoid writing scripts in files if possible, especially if the script is likely only to be run once
- Avoid having files over 200-300 lines of code. Refactor at that point.
- Mocking data is only needed for tests, never mock data for dev or prod
- Never add stubbing or fake data patterns to code that affects the dev or prod environments
- Never overwrite my .env file without first asking and confirming
- Focus on the areas of code relevant to the task
- Do not touch code that is unrelated to the task
- Write thorough tests for all major functionality
- Avoid making major changes to the patterns and architecture of how a feature works, after it has shown to work well, unless explicitly instructed
- Always think about what other methods and areas of code might be affected by code changes
**Project Approach**

* Always check for a PRD (Product Requirements Document) before starting a new task and follow it closely
* Look for comprehensive project documentation to understand requirements before making changes
* Focus only on code areas relevant to the assigned task
* Prefer iterating on existing code rather than creating new solutions
* Keep solutions simple and avoid introducing unnecessary complexity

**Code Quality**

* Keep files under 300 lines of code; refactor when approaching this limit
* Maintain a clean, organized codebase
* Avoid code duplication by checking for similar existing functionality
* Write thorough tests for all major functionality
* Consider different environments (dev, test, prod) when writing code
* Unless explicitly instructed, instead of trying to gracefully handle an error or failure, make sure to fix the underlying issue.

**Development Workflow**

* Kill all related running servers before starting a new one
* Always start a new server after making changes to allow for testing
* Make only requested changes or changes you're confident are well understood
* Consider what other code areas might be affected by your changes
* Don't drastically change existing patterns without explicit instruction

**Version Control**

* Never leave unstaged/untracked files after committing to git
* Don't create new branches unless explicitly requested
* Never commit .env files to version control
* Never overwrite .env files without first asking and confirming

**Best Practices**

* Avoid writing one-time scripts in permanent files
* Don't mock data except for tests (never for dev or prod environments)
* Exhaust all options using existing implementations before introducing new patterns
* If introducing a new pattern to replace an old one, remove the old implementation