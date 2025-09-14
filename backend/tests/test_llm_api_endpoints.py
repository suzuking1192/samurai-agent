"""
Test LLM API endpoints.
"""
import pytest
import json
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)


class TestLLMAPIEndpoints:
    """Test LLM-related API endpoints."""
    
    def test_get_llm_models_endpoint(self):
        """Test GET /projects/{project_id}/llm-models endpoint."""
        with patch('backend.services.file_service.file_service.get_project_by_id') as mock_get_project, \
             patch('backend.services.llm_providers.llm_provider_service.llm_provider_service.get_available_llm_models') as mock_get_models, \
             patch('backend.services.project_settings_service.ProjectSettingsService.get_selected_llm_model') as mock_get_selected:
            
            # Mock project exists
            mock_project = MagicMock()
            mock_project.id = "test-project-id"
            mock_get_project.return_value = mock_project
            
            # Mock available models
            mock_models = [
                {"id": "gemini-gemini-2.5-flash", "name": "Gemini - gemini-2.5-flash", "provider": "Gemini"},
                {"id": "openai-gpt-4o", "name": "OpenAI - gpt-4o", "provider": "OpenAI"}
            ]
            mock_get_models.return_value = mock_models
            
            # Mock selected model
            mock_get_selected.return_value = "gemini-gemini-2.5-flash"
            
            response = client.get("/projects/test-project-id/llm-models")
            
            assert response.status_code == 200
            data = response.json()
            assert data["project_id"] == "test-project-id"
            assert len(data["available_models"]) == 2
            assert data["selected_model_id"] == "gemini-gemini-2.5-flash"
    
    def test_get_llm_models_endpoint_project_not_found(self):
        """Test GET /projects/{project_id}/llm-models endpoint with non-existent project."""
        with patch('backend.services.file_service.file_service.get_project_by_id') as mock_get_project:
            mock_get_project.return_value = None
            
            response = client.get("/projects/non-existent-project/llm-models")
            
            assert response.status_code == 404
            data = response.json()
            assert "Project not found" in data["detail"]
    
    def test_set_llm_model_endpoint(self):
        """Test POST /projects/{project_id}/llm-model endpoint."""
        with patch('backend.services.file_service.file_service.get_project_by_id') as mock_get_project, \
             patch('backend.services.llm_providers.llm_provider_service.llm_provider_service.get_available_llm_models') as mock_get_models, \
             patch('backend.services.project_settings_service.ProjectSettingsService.set_selected_llm_model') as mock_set_model:
            
            # Mock project exists
            mock_project = MagicMock()
            mock_project.id = "test-project-id"
            mock_get_project.return_value = mock_project
            
            # Mock available models
            mock_models = [
                {"id": "gemini-gemini-2.5-flash", "name": "Gemini - gemini-2.5-flash", "provider": "Gemini"},
                {"id": "openai-gpt-4o", "name": "OpenAI - gpt-4o", "provider": "OpenAI"}
            ]
            mock_get_models.return_value = mock_models
            
            # Mock successful model setting
            mock_set_model.return_value = True
            
            response = client.post(
                "/projects/test-project-id/llm-model",
                json={"model_id": "openai-gpt-4o"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["project_id"] == "test-project-id"
            assert data["selected_model_id"] == "openai-gpt-4o"
            assert data["success"] is True
    
    def test_set_llm_model_endpoint_invalid_model(self):
        """Test POST /projects/{project_id}/llm-model endpoint with invalid model."""
        with patch('backend.services.file_service.file_service.get_project_by_id') as mock_get_project, \
             patch('backend.services.llm_providers.llm_provider_service.llm_provider_service.get_available_llm_models') as mock_get_models:
            
            # Mock project exists
            mock_project = MagicMock()
            mock_project.id = "test-project-id"
            mock_get_project.return_value = mock_project
            
            # Mock available models
            mock_models = [
                {"id": "gemini-gemini-2.5-flash", "name": "Gemini - gemini-2.5-flash", "provider": "Gemini"}
            ]
            mock_get_models.return_value = mock_models
            
            response = client.post(
                "/projects/test-project-id/llm-model",
                json={"model_id": "invalid-model"}
            )
            
            assert response.status_code == 400
            data = response.json()
            assert "not available" in data["detail"]
    
    def test_set_llm_model_endpoint_missing_model_id(self):
        """Test POST /projects/{project_id}/llm-model endpoint with missing model_id."""
        with patch('backend.services.file_service.file_service.get_project_by_id') as mock_get_project:
            # Mock project exists
            mock_project = MagicMock()
            mock_project.id = "test-project-id"
            mock_get_project.return_value = mock_project
            
            response = client.post(
                "/projects/test-project-id/llm-model",
                json={}
            )
            
            assert response.status_code == 400
            data = response.json()
            assert "model_id is required" in data["detail"]


if __name__ == "__main__":
    pytest.main([__file__])
