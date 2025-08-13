import os
import sys
import tempfile
import shutil
import unittest
from unittest import mock


class TestTaskCreationParentAssignment(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        # Add backend directory to sys.path for imports like `from services...`
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
        backend_dir = os.path.join(repo_root, 'backend')
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)

    def setUp(self):
        # Create a temporary data directory for file storage isolation
        self.temp_dir = tempfile.mkdtemp(prefix="samurai_agent_test_data_")

        # Import here after sys.path setup
        from services.file_service import FileService

        # Capture temp_dir for closure use inside the subclass
        tdir = self.temp_dir

        class TempFileService(FileService):
            def __init__(self):
                super().__init__(data_dir=tdir, backup_dir=os.path.join(tdir, 'backups'))

        # Patch TaskService to use our TempFileService internally
        self.taskservice_fs_patch = mock.patch('services.task_service.FileService', TempFileService)
        self.taskservice_fs_patch.start()

    def tearDown(self):
        # Stop patches and clean up temp directory
        self.taskservice_fs_patch.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    async def test_subtasks_attach_to_created_root_when_no_active_task(self):
        # Arrange
        from services.unified_samurai_agent import UnifiedSamuraiAgent

        agent = UnifiedSamuraiAgent()
        project_id = 'test-project-parent-assignment'

        # Simulate LLM breakdown with invalid parent_task_id for subtasks when no active task
        task_breakdown = [
            {"title": "Root: Implement Feature X", "description": "Root task", "parent_task_id": None},
            {"title": "Child 1", "description": "Subtask 1", "parent_task_id": "fake-parent-id"},
            {"title": "Child 2", "description": "Subtask 2"},  # no parent specified
        ]

        # Act
        results = await agent._execute_task_creation(task_breakdown, project_id, parent_task_id_override=None)

        # Assert: all tasks should be created successfully and children attached to created root
        self.assertEqual(len(results), 3)
        self.assertTrue(results[0].get('success'), f"Root creation failed: {results[0]}")
        self.assertTrue(results[1].get('success'), f"Child 1 creation failed: {results[1]}")
        self.assertTrue(results[2].get('success'), f"Child 2 creation failed: {results[2]}")

        root_id = results[0].get('task_id')
        self.assertIsNotNone(root_id)

        # Verify on-disk tasks have correct parent linkage
        from services.file_service import FileService
        fs = FileService(data_dir=self.temp_dir, backup_dir=os.path.join(self.temp_dir, 'backups'))
        tasks = fs.load_tasks(project_id)
        tasks_by_title = {t.title: t for t in tasks}
        self.assertIsNone(tasks_by_title['Root: Implement Feature X'].parent_task_id)
        self.assertEqual(tasks_by_title['Child 1'].parent_task_id, root_id)
        self.assertEqual(tasks_by_title['Child 2'].parent_task_id, root_id)


if __name__ == '__main__':
    unittest.main()


