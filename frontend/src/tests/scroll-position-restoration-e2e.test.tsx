import { test, expect } from '@playwright/test'

test.describe('Scroll Position Restoration E2E', () => {
  test('should restore scroll position when returning from task detail modal', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173')
    
    // Wait for the app to load
    await page.waitForSelector('.app')
    
    // Select a project if needed (assuming there's a project selector)
    const projectSelector = page.locator('.project-selector select')
    if (await projectSelector.isVisible()) {
      await projectSelector.selectOption({ index: 0 })
    }
    
    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 })
    
    // Get the task board container
    const taskBoard = page.locator('.task-board')
    await expect(taskBoard).toBeVisible()
    
    // Scroll to a specific position (e.g., 200px down)
    await page.evaluate(() => {
      const taskBoard = document.querySelector('.task-board')
      if (taskBoard) {
        taskBoard.scrollTop = 200
      }
    })
    
    // Verify we scrolled to the position
    const scrollTop = await page.evaluate(() => {
      const taskBoard = document.querySelector('.task-board')
      return taskBoard?.scrollTop || 0
    })
    expect(scrollTop).toBe(200)
    
    // Find and click on a task to open the detail modal
    const taskCard = page.locator('.task-card').first()
    await expect(taskCard).toBeVisible()
    
    // Get the task title for later verification
    const taskTitle = await taskCard.locator('.task-title, div[style*="font-weight"]').textContent()
    expect(taskTitle).toBeTruthy()
    
    // Click on the task to open detail view
    await taskCard.click()
    
    // Wait for the task detail view to appear
    await page.waitForSelector('.task-details-panel', { timeout: 5000 })
    
    // Verify we're in the detail view
    await expect(page.locator('.task-details-panel')).toBeVisible()
    await expect(page.locator('.back-button')).toBeVisible()
    
    // Click the back button to return to the task list
    await page.locator('.back-button').click()
    
    // Wait for the task board to be visible again
    await page.waitForSelector('.task-board', { timeout: 5000 })
    
    // Verify we're back to the task list
    await expect(page.locator('.task-board')).toBeVisible()
    
    // Check that the scroll position has been restored
    const restoredScrollTop = await page.evaluate(() => {
      const taskBoard = document.querySelector('.task-board')
      return taskBoard?.scrollTop || 0
    })
    
    // The scroll position should be restored (allowing for small differences due to rendering)
    expect(restoredScrollTop).toBeGreaterThan(0)
    
    // Verify the previously selected task is visible and highlighted
    const previouslySelectedTask = page.locator('.task-card.previously-selected')
    await expect(previouslySelectedTask).toBeVisible({ timeout: 3000 })
    
    // Verify the task title matches
    const highlightedTaskTitle = await previouslySelectedTask.locator('.task-title, div[style*="font-weight"]').textContent()
    expect(highlightedTaskTitle).toBe(taskTitle)
  })
  
  test('should handle multiple task selections and scroll restoration', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173')
    
    // Wait for the app to load
    await page.waitForSelector('.app')
    
    // Select a project if needed
    const projectSelector = page.locator('.project-selector select')
    if (await projectSelector.isVisible()) {
      await projectSelector.selectOption({ index: 0 })
    }
    
    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 })
    
    // Scroll to different positions and test multiple task selections
    for (let i = 0; i < 3; i++) {
      // Scroll to a different position each time
      const scrollPosition = 100 + (i * 50)
      await page.evaluate((pos) => {
        const taskBoard = document.querySelector('.task-board')
        if (taskBoard) {
          taskBoard.scrollTop = pos
        }
      }, scrollPosition)
      
      // Verify scroll position
      const currentScrollTop = await page.evaluate(() => {
        const taskBoard = document.querySelector('.task-board')
        return taskBoard?.scrollTop || 0
      })
      expect(currentScrollTop).toBe(scrollPosition)
      
      // Click on a task
      const taskCards = page.locator('.task-card')
      const taskCount = await taskCards.count()
      if (taskCount > 0) {
        const randomIndex = i % taskCount
        const taskCard = taskCards.nth(randomIndex)
        await taskCard.click()
        
        // Wait for detail view
        await page.waitForSelector('.task-details-panel', { timeout: 5000 })
        
        // Go back
        await page.locator('.back-button').click()
        
        // Wait for task board
        await page.waitForSelector('.task-board', { timeout: 5000 })
        
        // Verify scroll position is restored
        const restoredScrollTop = await page.evaluate(() => {
          const taskBoard = document.querySelector('.task-board')
          return taskBoard?.scrollTop || 0
        })
        
        expect(restoredScrollTop).toBeGreaterThan(0)
      }
    }
  })
  
  test('should persist scroll position across page refreshes', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173')
    
    // Wait for the app to load
    await page.waitForSelector('.app')
    
    // Select a project if needed
    const projectSelector = page.locator('.project-selector select')
    if (await projectSelector.isVisible()) {
      await projectSelector.selectOption({ index: 0 })
    }
    
    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 })
    
    // Scroll to a position
    await page.evaluate(() => {
      const taskBoard = document.querySelector('.task-board')
      if (taskBoard) {
        taskBoard.scrollTop = 300
      }
    })
    
    // Click on a task to save the scroll position
    const taskCard = page.locator('.task-card').first()
    await taskCard.click()
    
    // Wait for detail view
    await page.waitForSelector('.task-details-panel', { timeout: 5000 })
    
    // Go back
    await page.locator('.back-button').click()
    
    // Wait for task board
    await page.waitForSelector('.task-board', { timeout: 5000 })
    
    // Refresh the page
    await page.reload()
    
    // Wait for the app to load again
    await page.waitForSelector('.app')
    
    // Select the same project if needed
    if (await projectSelector.isVisible()) {
      await projectSelector.selectOption({ index: 0 })
    }
    
    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 })
    
    // Check that the scroll position is restored after page refresh
    const restoredScrollTop = await page.evaluate(() => {
      const taskBoard = document.querySelector('.task-board')
      return taskBoard?.scrollTop || 0
    })
    
    // The scroll position should be restored (allowing for small differences)
    expect(restoredScrollTop).toBeGreaterThan(0)
  })
})
