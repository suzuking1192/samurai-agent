import os
import sys
import tempfile
import shutil
import unittest
from unittest import mock


class TestEndSessionImmediateResponse(unittest.IsolatedAsyncioTestCase):
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

        # Create a project and a session to end
        from models import Project
        project = Project(
            id='proj-1',
            name='Test Project',
            description='Desc',
            tech_stack='Python'
        )
        self.file_service.save_project(project)
        session = self.file_service.create_session('proj-1', name='Session 1')
        self.session_id = session.id
        self.project_id = 'proj-1'

    def tearDown(self):
        self.file_service_patch.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    async def test_end_session_returns_immediately_and_schedules_task(self):
        # Patch asyncio.create_task to ensure background scheduling happens
        with mock.patch('asyncio.create_task') as mock_create_task:
            # Minimal fake Request with json() method
            class FakeRequest:
                def __init__(self, payload):
                    self._payload = payload
                async def json(self):
                    return self._payload

            req = FakeRequest({"session_id": self.session_id})
            body = await self.main.end_session_with_consolidation(self.project_id, req)

            self.assertEqual(body.get('status'), 'processing_started')
            self.assertIsInstance(body.get('new_session_id'), str)
            # Ensure background task scheduled
            self.assertTrue(mock_create_task.called, "Background task was not scheduled")


class TestBackgroundTaskBehavior(unittest.IsolatedAsyncioTestCase):
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

        import main as main_module
        from services.file_service import FileService

        tdir = self.temp_dir
        class TempFileService(FileService):
            def __init__(self):
                super().__init__(data_dir=tdir, backup_dir=os.path.join(tdir, 'backups'))

        self.main = main_module
        self.TempFileService = TempFileService

        # Patch globals used by the background task
        self.file_service_patch = mock.patch.object(self.main, 'file_service', TempFileService())
        self.file_service = self.file_service_patch.start()

        # Create project, session, and some messages
        from models import Project, ChatMessage
        project = Project(
            id='proj-2',
            name='Test Project 2',
            description='Desc',
            tech_stack='Python'
        )
        self.file_service.save_project(project)
        session = self.file_service.create_session('proj-2', name='S1')
        self.session_id = session.id
        self.project_id = 'proj-2'
        # add a couple of messages
        m1 = ChatMessage(project_id='proj-2', session_id=self.session_id, message='Hi', response='Hello')
        m2 = ChatMessage(project_id='proj-2', session_id=self.session_id, message='Plan', response='Okay')
        self.file_service.save_chat_message('proj-2', m1)
        self.file_service.save_chat_message('proj-2', m2)

    def tearDown(self):
        self.file_service_patch.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    async def test_background_success_flow(self):
        # Mock consolidation to avoid LLM calls
        from services.intelligent_memory_consolidation import MemoryConsolidationResult

        async def fake_consolidate(**kwargs):
            return MemoryConsolidationResult(
                status='completed',
                total_insights_processed=1,
                total_insights_skipped=0,
                categories_affected=[],
                new_categories_created=[],
                total_memories_affected=0,
                session_relevance=1.0,
            )

        with mock.patch.object(self.main, 'memory_consolidation_service') as mock_mc, \
             mock.patch.object(self.main, 'project_detail_service') as mock_pds:
            mock_mc.consolidate_session_memories.side_effect = lambda **kwargs: fake_consolidate(**kwargs)

            async def fake_ingest(**kwargs):
                return "ok"
            mock_pds.ingest_project_detail.side_effect = lambda **kwargs: fake_ingest(**kwargs)

            await self.main._perform_session_end_background_tasks(self.project_id, self.session_id)

            self.assertTrue(mock_mc.consolidate_session_memories.called)
            self.assertTrue(mock_pds.ingest_project_detail.called)

    async def test_background_logs_on_error(self):
        with mock.patch.object(self.main, 'memory_consolidation_service') as mock_mc:
            async def raise_err(**kwargs):
                raise RuntimeError('boom')
            mock_mc.consolidate_session_memories.side_effect = lambda **kwargs: raise_err(**kwargs)

            with self.assertLogs(self.main.logger.name, level='ERROR') as cm:
                await self.main._perform_session_end_background_tasks(self.project_id, self.session_id)
                # Ensure at least one error line is logged
                self.assertTrue(any('Error in background session end task' in r for r in cm.output))


