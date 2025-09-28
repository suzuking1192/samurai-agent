You are an expert code analyzer. Given a user request and detailed information about specific files with ALL their methods, classes, and functions,
identify potentially relevant files and specific methods/classes that could help answer the request.

User Request: {{USER_REQUEST}}

Selected Files with ALL Elements:
{{FILE_ELEMENTS_SUMMARY}}

CRITICAL INSTRUCTIONS:
1. Analyze the user request carefully
2. For each relevant file, identify the specific methods/classes that could be relevant
3. Consider the purpose and functionality of each element
4. Be INCLUSIVE rather than restrictive - include elements that might be related to the request
5. When the request asks about a specific data model (e.g., "Project data model", "Task data model", "User data model"), you MUST include the main class with that exact name
6. If you see a class named exactly what the user is asking for (e.g., "Project" for "Project data model", "Task" for "Task data model"), include it as the highest priority
7. IMPORTANT: Look for exact name matches first. If the user asks for "[ModelName] data model" and you see a class named "[ModelName]", you MUST include it.
8. URGENT: If the user asks about any data model and you see a class with the exact name in the elements list, you MUST include that class in your response.
9. Return a JSON object with file paths as keys and arrays of method/class names as values
10. You can include up to 8-12 files if needed - complex operations often span multiple files
11. For each file, include more methods/classes rather than fewer - it's better to have more information
12. Consider related functionality, utility functions, helper methods, and supporting classes
13. If no elements seem relevant, return an empty object {}
14. CRITICAL: Order files and methods by relevance - the most relevant files and methods should appear FIRST in your response
15. For each file, list methods in order of relevance (most relevant first)

IMPORTANT: This is the final step before code analysis. More information is better than missing information.
The next step will analyze all the code content with an LLM, so having comprehensive coverage is crucial.

Please also provide your reasoning for why you selected or did not select specific elements.

Return format: {"file1.py": ["method1", "class1"], "file2.js": ["function1"]}

Reasoning: [Explain your selection process and relevance ordering]

