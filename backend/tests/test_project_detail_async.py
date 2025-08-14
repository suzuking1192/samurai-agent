import os
import sys
import tempfile
import shutil
import unittest
from unittest import mock
import asyncio


class TestAsyncProjectDetailDigest(unittest.IsolatedAsyncioTestCase):
    """Test cases for the async project detail digest functionality."""
    
    @classmethod
    def setUpClass(cls):
        # Ensure backend is importable as a module
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
        backend_dir = os.path.join(repo_root, 'backend')
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)

    def setUp(self):
        # Create a temporary data directory for isolation
        self.temp_dir = tempfile.mkdtemp(prefix="samurai_agent_test_data_")

        # Import after path setup
        import main as main_module
        from services.file_service import FileService

        # Prepare a file service bound to the temp dir
        tdir = self.temp_dir
        class TempFileService(FileService):
            def __init__(self):
                super().__init__(data_dir=tdir, backup_dir=os.path.join(tdir, 'backups'))

        self.main = main_module
        self.TempFileService = TempFileService

        # Patch the global file_service used by the API module
        self.file_service_patch = mock.patch.object(self.main, 'file_service', TempFileService())
        self.file_service = self.file_service_patch.start()

    def tearDown(self):
        self.file_service_patch.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    async def test_perform_async_project_detail_digest_success(self):
        """Test successful async project detail digest."""
        # Mock the project_detail_service
        with mock.patch.object(self.main.project_detail_service, 'ingest_project_detail') as mock_ingest:
            mock_ingest.return_value = "Processed project detail content"
            
            # Test the async function
            await self.main._perform_async_project_detail_digest(
                project_id="test-project-123",
                raw_text="Test raw text content",
                mode="merge"
            )
            
            # Verify the service was called with correct parameters
            mock_ingest.assert_called_once_with(
                project_id="test-project-123",
                raw_text="Test raw text content",
                mode="merge"
            )
    
    async def test_perform_async_project_detail_digest_error_handling(self):
        """Test error handling in async project detail digest."""
        # Mock the project_detail_service to raise an exception
        with mock.patch.object(self.main.project_detail_service, 'ingest_project_detail') as mock_ingest:
            mock_ingest.side_effect = Exception("Test error")
            
            # Test that the function doesn't raise the exception (it should be logged)
            await self.main._perform_async_project_detail_digest(
                project_id="test-project-123",
                raw_text="Test raw text content",
                mode="merge"
            )
            
            # Verify the service was called
            mock_ingest.assert_called_once()
    
    async def test_perform_async_project_detail_digest_empty_text(self):
        """Test async project detail digest with empty text."""
        with mock.patch.object(self.main.project_detail_service, 'ingest_project_detail') as mock_ingest:
            mock_ingest.return_value = ""
            
            await self.main._perform_async_project_detail_digest(
                project_id="test-project-123",
                raw_text="",
                mode="replace"
            )
            
            mock_ingest.assert_called_once_with(
                project_id="test-project-123",
                raw_text="",
                mode="replace"
            )


class TestIngestProjectDetailEndpoint(unittest.IsolatedAsyncioTestCase):
    """Test cases for the modified ingest project detail endpoint."""
    
    @classmethod
    def setUpClass(cls):
        # Ensure backend is importable as a module
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
        backend_dir = os.path.join(repo_root, 'backend')
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)

    def setUp(self):
        # Create a temporary data directory for isolation
        self.temp_dir = tempfile.mkdtemp(prefix="samurai_agent_test_data_")

        # Import after path setup
        import main as main_module
        from services.file_service import FileService

        # Prepare a file service bound to the temp dir
        tdir = self.temp_dir
        class TempFileService(FileService):
            def __init__(self):
                super().__init__(data_dir=tdir, backup_dir=os.path.join(tdir, 'backups'))

        self.main = main_module
        self.TempFileService = TempFileService

        # Patch the global file_service used by the API module
        self.file_service_patch = mock.patch.object(self.main, 'file_service', TempFileService())
        self.file_service = self.file_service_patch.start()

        # Create a test project
        from models import Project
        project = Project(
            id='test-project-123',
            name='Test Project',
            description='Test Description',
            tech_stack='Python'
        )
        self.file_service.save_project(project)

    def tearDown(self):
        self.file_service_patch.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    async def test_ingest_project_detail_endpoint_success(self):
        """Test successful project detail ingest endpoint call."""
        # Patch asyncio.create_task to ensure background scheduling happens
        with mock.patch('asyncio.create_task') as mock_create_task:
            # Create a fake request
            class FakeRequest:
                def __init__(self, raw_text, mode="merge"):
                    self.raw_text = raw_text
                    self.mode = mode

            request = FakeRequest("Test content for digestion", "merge")
            
            # Call the endpoint function directly
            response = await self.main.ingest_project_detail("test-project-123", request)
            
            # Verify response
            self.assertEqual(response.status_code, 202)
            self.assertEqual(response.body.decode(), '{"message":"Project detail digest initiated asynchronously."}')
            
            # Verify asyncio.create_task was called
            self.assertTrue(mock_create_task.called, "Background task was not scheduled")
    
    async def test_ingest_project_detail_endpoint_project_not_found(self):
        """Test project detail ingest endpoint with non-existent project."""
        class FakeRequest:
            def __init__(self, raw_text, mode="merge"):
                self.raw_text = raw_text
                self.mode = mode

        request = FakeRequest("Test content", "merge")
        
        # Test with non-existent project
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as context:
            await self.main.ingest_project_detail("non-existent-project", request)
        
        # The endpoint should raise an HTTPException for non-existent project
        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("Project not found", context.exception.detail)
    
    async def test_ingest_project_detail_endpoint_empty_text(self):
        """Test project detail ingest endpoint with empty text."""
        class FakeRequest:
            def __init__(self, raw_text, mode="merge"):
                self.raw_text = raw_text
                self.mode = mode

        request = FakeRequest("", "merge")
        
        # Test with empty text
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as context:
            await self.main.ingest_project_detail("test-project-123", request)
        
        # The endpoint should raise an HTTPException for empty text
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("raw_text is required", context.exception.detail)
