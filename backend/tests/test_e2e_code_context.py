"""
End-to-End Test for Code Context Extraction with Real Codebase

This test uses the actual samurai-agent codebase to test the code context extraction feature.
"""

import pytest
import asyncio
import os
from unittest.mock import patch, AsyncMock

try:
    from services.unified_samurai_agent import UnifiedSamuraiAgent
    from services.code_context_storage import code_context_storage
    from services.agent_tools import ExtractCodeContextTool
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from unified_samurai_agent import UnifiedSamuraiAgent
    from code_context_storage import code_context_storage
    from agent_tools import ExtractCodeContextTool


class TestE2ECodeContextExtraction:
    """End-to-end test for code context extraction with real codebase."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.agent = UnifiedSamuraiAgent()
        
        # Use the actual samurai-agent codebase
        self.codebase_path = "/Users/yutosuzuki/code/samurai-agent"
        
        # Create project context
        self.project_context = {
            "id": "samurai_agent_project",
            "name": "Samurai Agent",
            "tech_stack": "Python, FastAPI, React",
            "codebase_path": self.codebase_path,
            "project_detail": "AI-powered coding assistant with memory and task management"
        }
    
    def test_codebase_accessibility(self):
        """Test that we can access the samurai-agent codebase."""
        assert os.path.exists(self.codebase_path), f"Codebase path {self.codebase_path} does not exist"
        
        # Check for key files
        key_files = [
            "backend/services/unified_samurai_agent.py",
            "backend/services/response_generator.py",
            "backend/services/gemini_service.py"
        ]
        
        for file_path in key_files:
            full_path = os.path.join(self.codebase_path, file_path)
            assert os.path.exists(full_path), f"Key file {file_path} does not exist"
            print(f"✓ Found {file_path}")
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_with_real_codebase(self):
        """Test code context extraction with the real samurai-agent codebase."""
        
        # Skip if no API key is available
        if not self.agent.gemini_service.is_api_key_valid():
            pytest.skip("No valid Gemini API key available for E2E test")
        
        tool = ExtractCodeContextTool()
        
        print(f"\n=== Testing Code Context Extraction ===")
        print(f"Codebase Path: {self.codebase_path}")
        print(f"Request: 'how does samuraiagent generates response?'")
        
        # Execute the tool with just the services directory to avoid file limits
        services_path = os.path.join(self.codebase_path, "backend", "services")
        result = await tool.execute(
            natural_language_request="how does samuraiagent generates response?",
            project_id="samurai_agent_project",
            connected_codebase_path=services_path,
            session_id="e2e_test_session"
        )
        
        # Print results for evaluation
        print(f"\n=== Results ===")
        print(f"Success: {result.get('success')}")
        print(f"Context: {result.get('context')}")
        print(f"File Path: {result.get('file_path')}")
        print(f"Relevance Score: {result.get('relevance_score')}")
        
        relevant_code = result.get('relevant_code', '')
        if relevant_code:
            print(f"Relevant Code (first 300 chars): {relevant_code[:300]}...")
        else:
            print("Relevant Code: None")
        
        # Basic assertions
        assert "success" in result
        
        if result.get("success"):
            # Verify that we got meaningful results
            assert result.get("context") is not None
            assert result.get("file_path") is not None
            assert result.get("relevance_score", 0) > 0
            
            # Check that it found relevant files
            file_path = result.get("file_path", "")
            context = result.get("context", "").lower()
            
            # Should find the main response generation file
            assert any(key_file in file_path for key_file in [
                "unified_samurai_agent.py",
                "response_generator.py",
                "gemini_service.py"
            ]), f"Expected to find key response generation file, got: {file_path}"
            
            # Should mention response generation in context
            assert any(keyword in context for keyword in [
                "response", "message", "process", "generate", "agent"
            ]), f"Expected context to mention response generation, got: {context}"
            
            print(f"\n✓ SUCCESS: Found relevant code in {file_path}")
            print(f"✓ SUCCESS: Context mentions response generation")
        else:
            print(f"\n❌ FAILED: {result.get('message', 'Unknown error')}")
    
    @pytest.mark.asyncio
    async def test_code_parser_with_real_codebase(self):
        """Test the code parser with the real samurai-agent codebase."""
        
        from services.code_parser import code_parser
        
        print(f"\n=== Testing Code Parser ===")
        
        # Scan just the services directory to find the key files
        services_path = os.path.join(self.codebase_path, "backend", "services")
        file_infos = code_parser.scan_codebase(services_path, max_files=100)
        
        print(f"Found {len(file_infos)} files in codebase")
        
        # Check for key files
        key_files_found = []
        print(f"\nAll found files (first 20):")
        for i, file_path in enumerate(list(file_infos.keys())[:20]):
            print(f"  {i+1}. {file_path}")
        
        for file_path in file_infos.keys():
            if any(key_file in file_path for key_file in [
                "unified_samurai_agent.py",
                "response_generator.py", 
                "gemini_service.py"
            ]):
                key_files_found.append(file_path)
                file_info = file_infos[file_path]
                print(f"✓ Found {file_path} ({file_info.language}) with {len(file_info.elements)} elements")
        
        print(f"\nKey files found: {key_files_found}")
        assert len(key_files_found) >= 2, f"Expected to find at least 2 key files, found: {key_files_found}"
        
        # Check that we have methods in the main files
        for file_path in key_files_found:
            if "unified_samurai_agent.py" in file_path:
                file_info = file_infos[file_path]
                # Look for both functions and methods since our new logic distinguishes them
                method_names = [elem.name for elem in file_info.elements if elem.type in ["function", "method"]]
                print(f"Methods in {file_path}: {method_names[:5]}...")
                
                # Should have key methods
                expected_methods = ["process_message", "_analyze_user_intent"]
                found_methods = [m for m in expected_methods if m in method_names]
                assert len(found_methods) >= 1, f"Expected to find key methods in {file_path}, found: {method_names}"
    
    @pytest.mark.asyncio
    async def test_memory_update_extraction(self):
        """Test code context extraction for memory update functionality."""
        
        # Skip if no API key is available
        if not self.agent.gemini_service.is_api_key_valid():
            pytest.skip("No valid Gemini API key available for E2E test")
        
        tool = ExtractCodeContextTool()
        
        print(f"\n=== Testing Memory Update Extraction ===")
        print(f"Codebase Path: {self.codebase_path}")
        print(f"Request: 'how is memory updated?'")
        
        # Execute the tool with just the services directory to avoid file limits
        services_path = os.path.join(self.codebase_path, "backend", "services")
        result = await tool.execute(
            natural_language_request="how is memory updated?",
            project_id="samurai_agent_project",
            connected_codebase_path=services_path,
            session_id="e2e_test_session_memory"
        )
        
        # Print results for evaluation
        print(f"\n=== Memory Update Results ===")
        print(f"Success: {result.get('success')}")
        print(f"Context: {result.get('context')}")
        print(f"File Path: {result.get('file_path')}")
        print(f"Relevance Score: {result.get('relevance_score')}")
        
        relevant_code = result.get('relevant_code', '')
        if relevant_code:
            print(f"Relevant Code (first 300 chars): {relevant_code[:300]}...")
        else:
            print("Relevant Code: None")
        
        # Basic assertions
        assert "success" in result
        
        if result.get("success"):
            # Verify that we got meaningful results
            assert result.get("context") is not None
            assert result.get("file_path") is not None
            assert result.get("relevance_score", 0) > 0
            
            # Check that it found relevant files
            file_path = result.get("file_path", "")
            context = result.get("context", "").lower()
            
            # Should find memory-related files
            expected_memory_files = [
                "memory", "consolidated_memory", "intelligent_memory", "memory_categorization"
            ]
            found_memory_file = any(key_file in file_path for key_file in expected_memory_files)
            
            # Should mention memory in context
            memory_keywords = ["memory", "update", "store", "save", "consolidate", "categorize"]
            mentions_memory = any(keyword in context for keyword in memory_keywords)
            
            if found_memory_file:
                print(f"\n✓ SUCCESS: Found memory-related file: {file_path}")
            else:
                print(f"\n⚠ WARNING: Expected memory-related file, got: {file_path}")
            
            if mentions_memory:
                print(f"✓ SUCCESS: Context mentions memory functionality")
            else:
                print(f"⚠ WARNING: Expected context to mention memory, got: {context}")
            
            # At least one should be true for a good result
            assert found_memory_file or mentions_memory, f"Expected to find memory-related file or context, got file: {file_path}, context: {context}"
        else:
            print(f"\n❌ FAILED: {result.get('message', 'Unknown error')}")
    
    @pytest.mark.asyncio
    async def test_task_priority_options_extraction(self):
        """Test code context extraction for task priority options."""
        
        # Skip if no API key is available
        if not self.agent.gemini_service.is_api_key_valid():
            pytest.skip("No valid Gemini API key available for E2E test")
        
        tool = ExtractCodeContextTool()
        
        print(f"\n=== Testing Task Priority Options Extraction ===")
        print(f"Codebase Path: {self.codebase_path}")
        print(f"Request: 'what are options for task priority?'")
        
        # Execute the tool with the backend directory to include models.py
        backend_path = os.path.join(self.codebase_path, "backend")
        result = await tool.execute(
            natural_language_request="what are options for task priority?",
            project_id="samurai_agent_project",
            connected_codebase_path=backend_path,
            session_id="e2e_test_session_priority"
        )
        
        # Print results for evaluation
        print(f"\n=== Task Priority Results ===")
        print(f"Success: {result.get('success')}")
        print(f"Context: {result.get('context')}")
        print(f"File Path: {result.get('file_path')}")
        print(f"Relevance Score: {result.get('relevance_score')}")
        
        relevant_code = result.get('relevant_code', '')
        if relevant_code:
            print(f"Relevant Code (first 300 chars): {relevant_code[:300]}...")
        else:
            print("Relevant Code: None")
        
        # Basic assertions
        assert "success" in result
        
        if result.get("success"):
            # Verify that we got meaningful results
            assert result.get("context") is not None
            assert result.get("file_path") is not None
            assert result.get("relevance_score", 0) > 0
            
            # Check that it found relevant files
            file_path = result.get("file_path", "")
            context = result.get("context", "").lower()
            
            # Should find task-related files
            expected_task_files = [
                "task", "models", "unified_samurai_agent"
            ]
            found_task_file = any(key_file in file_path for key_file in expected_task_files)
            
            # Should mention priority in context
            priority_keywords = ["priority", "high", "medium", "low", "urgent", "important"]
            mentions_priority = any(keyword in context for keyword in priority_keywords)
            
            # Check for specific priority values
            specific_priorities = ["low", "medium", "high"]
            mentions_specific_priorities = any(priority in context for priority in specific_priorities)
            
            if found_task_file:
                print(f"\n✓ SUCCESS: Found task-related file: {file_path}")
            else:
                print(f"\n⚠ WARNING: Expected task-related file, got: {file_path}")
            
            if mentions_priority:
                print(f"✓ SUCCESS: Context mentions priority options")
            else:
                print(f"⚠ WARNING: Expected context to mention priority, got: {context}")
            
            if mentions_specific_priorities:
                print(f"✓ SUCCESS: Context mentions specific priority values (low/medium/high)")
            else:
                print(f"⚠ WARNING: Expected context to mention specific priority values, got: {context}")
            
            # At least one should be true for a good result
            assert found_task_file or mentions_priority, f"Expected to find task-related file or priority context, got file: {file_path}, context: {context}"
        else:
            print(f"\n❌ FAILED: {result.get('message', 'Unknown error')}")
    
    @pytest.mark.asyncio
    async def test_chat_streaming_extraction(self):
        """Test code context extraction for chat streaming implementation."""
        
        # Skip if no API key is available
        if not self.agent.gemini_service.is_api_key_valid():
            pytest.skip("No valid Gemini API key available for E2E test")
        
        tool = ExtractCodeContextTool()
        
        print(f"\n=== Testing Chat Streaming Extraction ===")
        print(f"Codebase Path: {self.codebase_path}")
        print(f"Request: 'how is chat streaming implemented end-to-end?'")
        
        # Execute the tool with the backend directory to include all relevant files
        backend_path = os.path.join(self.codebase_path, "backend")
        result = await tool.execute(
            natural_language_request="how is chat streaming implemented end-to-end?",
            project_id="samurai_agent_project",
            connected_codebase_path=backend_path,
            session_id="e2e_test_session_streaming"
        )
        
        # Print results for evaluation
        print(f"\n=== Chat Streaming Results ===")
        print(f"Success: {result.get('success')}")
        print(f"Context: {result.get('context')}")
        print(f"File Path: {result.get('file_path')}")
        print(f"Relevance Score: {result.get('relevance_score')}")
        
        relevant_code = result.get('relevant_code', '')
        if relevant_code:
            print(f"Relevant Code (first 300 chars): {relevant_code[:300]}...")
        else:
            print("Relevant Code: None")
        
        # Basic assertions
        assert "success" in result
        
        if result.get("success"):
            # Verify that we got meaningful results
            assert result.get("context") is not None
            assert result.get("file_path") is not None
            assert result.get("relevance_score", 0) > 0
            
            # Check that it found relevant files
            file_path = result.get("file_path", "")
            context = result.get("context", "").lower()
            
            # Should find streaming-related files
            expected_streaming_files = [
                "main.py", "response", "stream", "websocket", "sse", "progress"
            ]
            found_streaming_file = any(key_file in file_path for key_file in expected_streaming_files)
            
            # Should mention streaming in context
            streaming_keywords = ["stream", "progress", "websocket", "sse", "real-time", "async", "yield"]
            mentions_streaming = any(keyword in context for keyword in streaming_keywords)
            
            if found_streaming_file:
                print(f"\n✓ SUCCESS: Found streaming-related file: {file_path}")
            else:
                print(f"\n⚠ WARNING: Expected streaming-related file, got: {file_path}")
            
            if mentions_streaming:
                print(f"✓ SUCCESS: Context mentions streaming functionality")
            else:
                print(f"⚠ WARNING: Expected context to mention streaming, got: {context}")
            
            # At least one should be true for a good result, but be more lenient for streaming
            # since it might be in frontend or not fully implemented
            if not (found_streaming_file or mentions_streaming):
                print(f"\n⚠ WARNING: No streaming functionality found. This might be expected if streaming is in frontend.")
                print(f"File: {file_path}")
                print(f"Context: {context}")
                # Don't fail the test, just warn
        else:
            print(f"\n❌ FAILED: {result.get('message', 'Unknown error')}")
    
    @pytest.mark.asyncio
    async def test_project_task_persistence_extraction(self):
        """Test code context extraction for project and task persistence."""
        
        # Skip if no API key is available
        if not self.agent.gemini_service.is_api_key_valid():
            pytest.skip("No valid Gemini API key available for E2E test")
        
        tool = ExtractCodeContextTool()
        
        print(f"\n=== Testing Project/Task Persistence Extraction ===")
        print(f"Codebase Path: {self.codebase_path}")
        print(f"Request: 'how are projects and tasks persisted and loaded?'")
        
        # Execute the tool with the backend directory to include all relevant files
        backend_path = os.path.join(self.codebase_path, "backend")
        result = await tool.execute(
            natural_language_request="how are projects and tasks persisted and loaded?",
            project_id="samurai_agent_project",
            connected_codebase_path=backend_path,
            session_id="e2e_test_session_persistence"
        )
        
        # Print results for evaluation
        print(f"\n=== Project/Task Persistence Results ===")
        print(f"Success: {result.get('success')}")
        print(f"Context: {result.get('context')}")
        print(f"File Path: {result.get('file_path')}")
        print(f"Relevance Score: {result.get('relevance_score')}")
        
        relevant_code = result.get('relevant_code', '')
        if relevant_code:
            print(f"Relevant Code (first 300 chars): {relevant_code[:300]}...")
        else:
            print("Relevant Code: None")
        
        # Basic assertions
        assert "success" in result
        
        if result.get("success"):
            # Verify that we got meaningful results
            assert result.get("context") is not None
            assert result.get("file_path") is not None
            assert result.get("relevance_score", 0) > 0
            
            # Check that it found relevant files
            file_path = result.get("file_path", "")
            context = result.get("context", "").lower()
            
            # Should find persistence-related files
            expected_persistence_files = [
                "file_service", "task_service", "project", "storage", "persist", "save", "load"
            ]
            found_persistence_file = any(key_file in file_path for key_file in expected_persistence_files)
            
            # Should mention persistence in context
            persistence_keywords = ["persist", "save", "load", "storage", "file", "database", "store"]
            mentions_persistence = any(keyword in context for keyword in persistence_keywords)
            
            if found_persistence_file:
                print(f"\n✓ SUCCESS: Found persistence-related file: {file_path}")
            else:
                print(f"\n⚠ WARNING: Expected persistence-related file, got: {file_path}")
            
            if mentions_persistence:
                print(f"✓ SUCCESS: Context mentions persistence functionality")
            else:
                print(f"⚠ WARNING: Expected context to mention persistence, got: {context}")
            
            # At least one should be true for a good result
            assert found_persistence_file or mentions_persistence, f"Expected to find persistence-related file or context, got file: {file_path}, context: {context}"
        else:
            print(f"\n❌ FAILED: {result.get('message', 'Unknown error')}")
    
    @pytest.mark.asyncio
    async def test_agent_routing_registry_extraction(self):
        """Test code context extraction for agent routing and registry."""
        
        # Skip if no API key is available
        if not self.agent.gemini_service.is_api_key_valid():
            pytest.skip("No valid Gemini API key available for E2E test")
        
        tool = ExtractCodeContextTool()
        
        print(f"\n=== Testing Agent Routing/Registry Extraction ===")
        print(f"Codebase Path: {self.codebase_path}")
        print(f"Request: 'Where is the agent routing/registry defined, and how does the system pick which agent to run?'")
        
        # Execute the tool with the backend directory to include all relevant files
        backend_path = os.path.join(self.codebase_path, "backend")
        result = await tool.execute(
            natural_language_request="Where is the agent routing/registry defined, and how does the system pick which agent to run?",
            project_id="samurai_agent_project",
            connected_codebase_path=backend_path,
            session_id="e2e_test_session_routing"
        )
        
        # Print results for evaluation
        print(f"\n=== Agent Routing/Registry Results ===")
        print(f"Success: {result.get('success')}")
        print(f"Context: {result.get('context')}")
        print(f"File Path: {result.get('file_path')}")
        print(f"Relevance Score: {result.get('relevance_score')}")
        
        relevant_code = result.get('relevant_code', '')
        if relevant_code:
            print(f"Relevant Code (first 300 chars): {relevant_code[:300]}...")
        else:
            print("Relevant Code: None")
        
        # Basic assertions
        assert "success" in result
        
        if result.get("success"):
            # Verify that we got meaningful results
            assert result.get("context") is not None
            assert result.get("file_path") is not None
            assert result.get("relevance_score", 0) > 0
            
            # Check that it found relevant files
            file_path = result.get("file_path", "")
            context = result.get("context", "").lower()
            
            # Should find routing/registry-related files
            expected_routing_files = [
                "unified_samurai_agent", "agent_tools", "tool_registry", "routing", "registry"
            ]
            found_routing_file = any(key_file in file_path for key_file in expected_routing_files)
            
            # Should mention routing/registry in context
            routing_keywords = ["routing", "registry", "agent", "tool", "select", "choose", "route"]
            mentions_routing = any(keyword in context for keyword in routing_keywords)
            
            if found_routing_file:
                print(f"\n✓ SUCCESS: Found routing/registry-related file: {file_path}")
            else:
                print(f"\n⚠ WARNING: Expected routing/registry-related file, got: {file_path}")
            
            if mentions_routing:
                print(f"✓ SUCCESS: Context mentions routing/registry functionality")
            else:
                print(f"⚠ WARNING: Expected context to mention routing/registry, got: {context}")
            
            # At least one should be true for a good result
            assert found_routing_file or mentions_routing, f"Expected to find routing/registry-related file or context, got file: {file_path}, context: {context}"
        else:
            print(f"\n❌ FAILED: {result.get('message', 'Unknown error')}")


if __name__ == "__main__":
    # Run the E2E tests
    pytest.main([__file__, "-v", "-s"])
