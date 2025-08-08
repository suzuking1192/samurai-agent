"""
Test to verify that task creation works with the async fix.
"""

import asyncio
import sys
import os
import uuid

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_task_creation_with_analysis():
    """Test that task creation works with analysis."""
    print("🔍 Testing task creation with analysis...")
    
    try:
        from services.agent_tools import CreateTaskTool
        
        tool = CreateTaskTool()
        
        # Test task creation
        result = await tool.execute(
            title="Test Task Creation",
            description="This is a test task with minimal detail",
            project_id=str(uuid.uuid4())
        )
        
        # Verify success
        assert result["success"] == True
        assert "task_id" in result
        assert "warning" in result["message"].lower() or "warnings" in result["message"].lower()
        
        print(f"   Result: {result['message']}")
        print("✅ Task creation with analysis works correctly")
        return True
        
    except Exception as e:
        print(f"❌ Task creation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_tool_registry_async():
    """Test that tool registry handles async tools correctly."""
    print("🔍 Testing tool registry async execution...")
    
    try:
        from services.agent_tools import AgentToolRegistry
        
        registry = AgentToolRegistry()
        
        # Test async tool execution
        result = await registry.execute_tool(
            "create_task",
            title="Registry Test Task",
            description="Testing registry async execution",
            project_id=str(uuid.uuid4())
        )
        
        # Verify success
        assert result["success"] == True
        assert "task_id" in result
        
        print(f"   Result: {result['message']}")
        print("✅ Tool registry async execution works correctly")
        return True
        
    except Exception as e:
        print(f"❌ Tool registry test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def run_fix_tests():
    """Run tests to verify the async fix."""
    print("🚀 Testing Task Creation Async Fix")
    print("=" * 50)
    
    tests = [
        ("Task Creation with Analysis", test_task_creation_with_analysis),
        ("Tool Registry Async", test_tool_registry_async)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if await test_func():
                passed += 1
            else:
                print(f"❌ {test_name} failed")
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Task creation async fix is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(run_fix_tests())
    sys.exit(0 if success else 1)
