const { test, expect } = require('@playwright/test');

test.describe('Create Tasks Button Integration', () => {
  test('should show Create Tasks button when agent response has spec_clarification intent', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForSelector('.chat-container');
    
    // Create a test project if needed
    const projectSelector = page.locator('.project-selector select');
    if (await projectSelector.count() === 0) {
      // Create a new project
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Project name"]', 'Test Project');
      await page.fill('textarea[placeholder="Project description"]', 'A test project for Create Tasks button');
      await page.fill('input[placeholder="Tech stack"]', 'React, Node.js');
      await page.click('button:has-text("Create Project")');
      await page.waitForSelector('.chat-container');
    }
    
    // Select the first available project
    await projectSelector.first().selectOption({ index: 0 });
    
    // Send a message that should trigger spec_clarification intent
    await page.fill('textarea[placeholder*="authentication"]', 'I want to add user authentication with JWT tokens');
    await page.click('button:has-text("Send")');
    
    // Wait for the agent response
    await page.waitForSelector('.ai-message');
    
    // Check if the Create Tasks button appears
    const createTasksButton = page.locator('button:has-text("Create tasks based on discussion so far")');
    await expect(createTasksButton).toBeVisible();
    
    // Verify the button is enabled
    await expect(createTasksButton).toBeEnabled();
  });

  test('should show Create Tasks button when agent response has feature_exploration intent', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForSelector('.chat-container');
    
    // Select the first available project
    const projectSelector = page.locator('.project-selector select');
    if (await projectSelector.count() > 0) {
      await projectSelector.first().selectOption({ index: 0 });
    }
    
    // Send a message that should trigger feature_exploration intent
    await page.fill('textarea[placeholder*="authentication"]', 'I want to add user authentication');
    await page.click('button:has-text("Send")');
    
    // Wait for the agent response
    await page.waitForSelector('.ai-message');
    
    // Check if the Create Tasks button appears
    const createTasksButton = page.locator('button:has-text("Create tasks based on discussion so far")');
    await expect(createTasksButton).toBeVisible();
    
    // Verify the button is enabled
    await expect(createTasksButton).toBeEnabled();
  });

  test('should not show Create Tasks button for other intent types', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForSelector('.chat-container');
    
    // Select the first available project
    const projectSelector = page.locator('.project-selector select');
    if (await projectSelector.count() > 0) {
      await projectSelector.first().selectOption({ index: 0 });
    }
    
    // Send a message that should trigger a different intent
    await page.fill('textarea[placeholder*="authentication"]', 'Hello, how are you?');
    await page.click('button:has-text("Send")');
    
    // Wait for the agent response
    await page.waitForSelector('.ai-message');
    
    // Check that the Create Tasks button does NOT appear
    const createTasksButton = page.locator('button:has-text("Create tasks based on discussion so far")');
    await expect(createTasksButton).not.toBeVisible();
  });

  test('should send create tasks message when button is clicked', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForSelector('.chat-container');
    
    // Select the first available project
    const projectSelector = page.locator('.project-selector select');
    if (await projectSelector.count() > 0) {
      await projectSelector.first().selectOption({ index: 0 });
    }
    
    // Send a message that should trigger spec_clarification intent
    await page.fill('textarea[placeholder*="authentication"]', 'I want to add user authentication with JWT tokens');
    await page.click('button:has-text("Send")');
    
    // Wait for the agent response
    await page.waitForSelector('.ai-message');
    
    // Wait for the Create Tasks button to appear
    const createTasksButton = page.locator('button:has-text("Create tasks based on discussion so far")');
    await expect(createTasksButton).toBeVisible();
    
    // Click the Create Tasks button
    await createTasksButton.click();
    
    // Verify that a new message was sent
    await page.waitForSelector('.user-message:has-text("create tasks with the discussion so far")');
    
    // Verify that the button is disabled during processing
    await expect(createTasksButton).toBeDisabled();
  });
});
