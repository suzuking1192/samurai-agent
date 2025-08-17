#!/usr/bin/env python3
"""
E2E Test for Complete Samurai Agent Workflow
Tests intent analysis, code context extraction, and final response generation
"""

import asyncio
import json
import requests
import time
import uuid
from typing import Dict, Any

# Configuration
API_BASE_URL = "http://localhost:8000"
CODEBASE_PATH = "/Users/yutosuzuki/code/samurai-agent"

class E2ETestWorkflow:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json"
        })
    
    def create_project(self, project_name: str) -> str:
        """Create a new project and return the project ID"""
        payload = {
            "name": project_name,
            "description": f"Test project for E2E workflow testing: {project_name}",
            "tech_stack": "Python, FastAPI, React, TypeScript"
        }
        
        response = self.session.post(f"{API_BASE_URL}/projects", json=payload)
        if response.status_code in [200, 201]:
            project_data = response.json()
            project_id = project_data.get("id")
            print(f"✅ Created project: {project_id}")
            
            # Connect codebase to the project
            self.connect_codebase(project_id)
            
            return project_id
        else:
            raise Exception(f"Failed to create project: {response.status_code} - {response.text}")
    
    def connect_codebase(self, project_id: str):
        """Connect the codebase to the project"""
        payload = {
            "path": CODEBASE_PATH,
            "project_id": project_id
        }
        
        response = self.session.post(f"{API_BASE_URL}/api/codebase/connect", json=payload)
        if response.status_code in [200, 201]:
            print(f"✅ Connected codebase to project: {project_id}")
        else:
            print(f"⚠️  Failed to connect codebase: {response.status_code} - {response.text}")
    
    def create_session(self, project_id: str) -> str:
        """Create a new session for the project and return the session ID"""
        payload = {
            "name": f"E2E Test Session {uuid.uuid4().hex[:8]}"
        }
        
        response = self.session.post(f"{API_BASE_URL}/projects/{project_id}/sessions", json=payload)
        if response.status_code in [200, 201]:
            session_data = response.json()
            session_id = session_data.get("id")
            print(f"✅ Created session: {session_id}")
            return session_id
        else:
            raise Exception(f"Failed to create session: {response.status_code} - {response.text}")
    
    def send_chat_message(self, project_id: str, message: str) -> Dict[str, Any]:
        """Send a chat message and return the response"""
        payload = {
            "message": message
        }
        
        response = self.session.post(f"{API_BASE_URL}/projects/{project_id}/chat", json=payload)
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to send chat message: {response.status_code} - {response.text}")
    
    def delete_project(self, project_id: str):
        """Delete a project"""
        response = self.session.delete(f"{API_BASE_URL}/projects/{project_id}")
        if response.status_code == 200:
            print(f"🗑️  Deleted project: {project_id}")
        else:
            print(f"⚠️  Failed to delete project {project_id}: {response.status_code}")
    
    def analyze_response(self, response: Dict[str, Any], expected_intent: str, 
                        expected_code_context: bool, scenario_name: str) -> bool:
        """Analyze the response and return True if it meets expectations"""
        print(f"\n📊 Analyzing response for: {scenario_name}")
        
        # Extract key information
        intent_analysis = response.get("intent_analysis", {})
        actual_intent = intent_analysis.get("intent_type", "unknown")
        actual_code_context = intent_analysis.get("new_code_context_necessary", False)
        code_context_request = intent_analysis.get("code_context_request")
        reasoning = intent_analysis.get("reasoning", "No reasoning provided")
        
        # Check intent analysis
        intent_correct = actual_intent == expected_intent
        print(f"   Intent Analysis: {actual_intent} (expected: {expected_intent}) {'✅' if intent_correct else '❌'}")
        
        # Check code context decision
        code_context_correct = actual_code_context == expected_code_context
        print(f"   Code Context Decision: {actual_code_context} (expected: {expected_code_context}) {'✅' if code_context_correct else '❌'}")
        
        # Check code context request
        if expected_code_context:
            has_request = code_context_request is not None and len(code_context_request.strip()) > 0
            print(f"   Code Context Request: {'✅ Provided' if has_request else '❌ Missing'}")
            if has_request:
                print(f"      Request: {code_context_request[:100]}...")
        else:
            print(f"   Code Context Request: {'✅ None (as expected)' if code_context_request is None else '❌ Should be None'}")
        
        # Check if code context was actually extracted
        code_context = response.get("code_context")
        if expected_code_context:
            context_extracted = code_context is not None
            print(f"   Code Context Extracted: {'✅ Yes' if context_extracted else '❌ No'}")
            if context_extracted:
                print(f"      Files: {len(code_context.get('relevant_code', {}))} files found")
        else:
            print(f"   Code Context Extracted: {'✅ None (as expected)' if code_context is None else '⚠️  Unexpected extraction'}")
        
        # Check response quality
        response_text = response.get("response", "")
        has_response = len(response_text.strip()) > 0
        print(f"   Response Generated: {'✅ Yes' if has_response else '❌ No'}")
        if has_response:
            print(f"      Length: {len(response_text)} characters")
            print(f"      Preview: {response_text[:150]}...")
        
        # Check reasoning
        print(f"   Reasoning: {reasoning}")
        
        # Overall assessment
        all_correct = intent_correct and code_context_correct and has_response
        if expected_code_context:
            all_correct = all_correct and (code_context_request is not None) and (code_context is not None)
        
        print(f"   Overall: {'✅ PASS' if all_correct else '❌ FAIL'}")
        return all_correct
    
    def run_scenario(self, scenario_name: str, message: str, expected_intent: str, 
                    expected_code_context: bool) -> bool:
        """Run a single test scenario"""
        print(f"\n{'='*80}")
        print(f"SCENARIO: {scenario_name}")
        print(f"{'='*80}")
        print(f"Message: '{message}'")
        print(f"Expected Intent: {expected_intent}")
        print(f"Expected Code Context: {expected_code_context}")
        
        project_id = None
        session_id = None
        
        try:
            # Create fresh project and session
            project_name = f"E2E Test Project {uuid.uuid4().hex[:8]}"
            project_id = self.create_project(project_name)
            session_id = self.create_session(project_id)
            
            # Send message and get response
            print(f"💬 Sending message...")
            response = self.send_chat_message(project_id, message)
            
            # Analyze response
            success = self.analyze_response(response, expected_intent, expected_code_context, scenario_name)
            
            return success
            
        except Exception as e:
            print(f"❌ Error in scenario '{scenario_name}': {e}")
            return False
        finally:
            # Clean up
            if project_id:
                self.delete_project(project_id)
    
    def run_all_scenarios(self):
        """Run all test scenarios"""
        print("🧪 E2E Complete Workflow Test")
        print("Testing intent analysis, code context extraction, and response generation")
        
        # Define test scenarios
        scenarios = [
            {
                "name": "System Functionality Question - Should Extract Code Context",
                "message": "How are projects and tasks persisted and loaded?",
                "expected_intent": "pure_discussion",
                "expected_code_context": True
            },
            {
                "name": "General Concept Question - Should NOT Extract Code Context",
                "message": "How does JWT authentication work?",
                "expected_intent": "pure_discussion", 
                "expected_code_context": False
            },
            {
                "name": "Code Implementation Question - Should Extract Code Context",
                "message": "How is JWT authentication implemented in our codebase?",
                "expected_intent": "pure_discussion",
                "expected_code_context": True
            },
            {
                "name": "Feature Exploration - Should NOT Extract Code Context",
                "message": "I'm thinking about adding a new dashboard feature with charts and analytics",
                "expected_intent": "feature_exploration",
                "expected_code_context": False
            },
            {
                "name": "Ready for Action - Should NOT Extract Code Context",
                "message": "Create tasks for implementing user authentication with JWT tokens and email/password login",
                "expected_intent": "ready_for_action",
                "expected_code_context": False
            }
        ]
        
        results = []
        
        for i, scenario in enumerate(scenarios, 1):
            print(f"\n{'='*80}")
            print(f"RUNNING SCENARIO {i}/{len(scenarios)}")
            print(f"{'='*80}")
            
            success = self.run_scenario(
                scenario["name"],
                scenario["message"], 
                scenario["expected_intent"],
                scenario["expected_code_context"]
            )
            
            results.append({
                "scenario": scenario["name"],
                "success": success
            })
            
            # Small delay between scenarios
            time.sleep(1)
        
        # Print final results
        print(f"\n{'='*80}")
        print("📊 FINAL RESULTS")
        print(f"{'='*80}")
        
        passed = sum(1 for r in results if r["success"])
        total = len(results)
        
        for i, result in enumerate(results, 1):
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{i}. {result['scenario']}: {status}")
        
        print(f"\n🎯 Overall: {passed}/{total} scenarios passed")
        print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 All scenarios passed! The complete workflow is working correctly.")
        else:
            print("⚠️  Some scenarios failed. Check the details above for issues.")
        
        return passed == total

def main():
    """Main test function"""
    try:
        # Check if server is running
        try:
            response = requests.get(f"{API_BASE_URL}/health", timeout=5)
            if response.status_code != 200:
                print("❌ Server is not responding correctly")
                return False
        except requests.exceptions.RequestException:
            print("❌ Cannot connect to server. Make sure it's running on http://localhost:8000")
            return False
        
        # Run the E2E test
        tester = E2ETestWorkflow()
        success = tester.run_all_scenarios()
        
        return success
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
