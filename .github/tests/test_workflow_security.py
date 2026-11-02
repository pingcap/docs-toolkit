"""Exercise the actual workflow scripts at their input and artifact trust boundaries."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / '.github/workflows'


def load_workflow(name):
    return yaml.safe_load((WORKFLOWS / name).read_text())


def step_named(workflow, job, name):
    return next(step for step in workflow['jobs'][job]['steps'] if step['name'] == name)


def run_script(step, directory, **env):
    return subprocess.run(
        ['bash', '-euo', 'pipefail', '-c', step['run']],
        cwd=directory,
        env={**os.environ, 'GITHUB_OUTPUT': str(directory / 'outputs'), **env},
        text=True, capture_output=True,
    )


class WorkflowSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keyword = load_workflow('keyword-sync.yaml')
        cls.llms = load_workflow('generate-llms-txt.yml')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def test_dispatch_allowlist_and_single_line_json_output(self):
        step = step_named(self.keyword, 'plan-branches', 'Resolve branches')
        # Stub only the branch-list command; run the unchanged workflow shell/Python.
        binary = self.directory / 'uv'
        binary.write_text('#!/bin/sh\nprintf \'["master", "release-8.5"]\\n\'\n')
        binary.chmod(0o755)
        for branch in ('', 'master', 'release-8.5', 'unknown',
                       'master$(touch injected)', 'master`touch injected`',
                       'master"; touch injected; #', 'master\nbranches=["other"]',
                       'master","release-evil'):
            with self.subTest(branch=branch):
                output = self.directory / 'outputs'
                output.unlink(missing_ok=True)
                result = run_script(step, self.directory, BRANCH=branch,
                                    PATH=str(self.directory) + os.pathsep + os.environ['PATH'])
                if branch in ('', 'master', 'release-8.5'):
                    self.assertEqual(result.returncode, 0, result.stderr)
                    lines = output.read_text().splitlines()
                    self.assertEqual(len(lines), 1)
                    self.assertEqual(json.loads(lines[0].removeprefix('branches=')),
                                     [branch] if branch else ['master', 'release-8.5'])
                else:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output.exists())
                self.assertFalse((self.directory / 'injected').exists())

    def test_credentials_stay_in_guarded_publishing_jobs(self):
        for workflow, publisher in ((self.keyword, 'publish-keywords'),
                                    (self.llms, 'publish-llms-txt')):
            self.assertEqual(workflow['permissions'], {'contents': 'read'})
            for name, job in workflow['jobs'].items():
                if name == publisher:
                    self.assertEqual(job['environment'], 'docs-automation')
                    self.assertIn("github.repository == 'pingcap/docs-toolkit'", job['if'])
                    self.assertIn('github.event.repository.default_branch', job['if'])
                for step in job['steps']:
                    if 'run' in step:
                        self.assertNotIn('${{', step['run'])
                    if step.get('uses', '').startswith('actions/checkout@'):
                        self.assertIs(step['with']['persist-credentials'], False)
                    if name != publisher:
                        self.assertNotIn('secrets.', json.dumps(step))
                    if step.get('uses', '').startswith('actions/create-github-app-token@'):
                        self.assertEqual(name, publisher)
                        self.assertIn(step['with']['repositories'],
                                      ('docs', 'docs-cn', 'docs-toolkit', 'website-docs'))
                        self.assertEqual(step['with']['permission-contents'], 'write')
                        self.assertEqual(step['with']['permission-pull-requests'], 'write')
                        if step['with']['repositories'] == 'docs-toolkit':
                            self.assertEqual(step['if'], "steps.state.outputs.changed == 'true'")
            steps = workflow['jobs'][publisher]['steps']
            validator = next(i for i, s in enumerate(steps) if s['name'] == 'Validate and apply generated data')
            first_token = next(i for i, s in enumerate(steps)
                               if s.get('uses', '').startswith('actions/create-github-app-token@'))
            self.assertLess(validator, first_token)
            self.assertFalse(any(s.get('uses', '').startswith(('actions/cache@', 'astral-sh/setup-uv@'))
                                 for s in steps))

    def keyword_payload(self):
        payload = self.directory / 'keyword-payload'
        payload.mkdir()
        for name in ('docs-keywords.md', 'docs-cn-keywords.md', 'keyword-sync-state.json',
                     'docs-pr-body.md', 'docs-pr-comment.md',
                     'docs_cn-pr-body.md', 'docs_cn-pr-comment.md'):
            (payload / name).write_text('generated data\n')
        (payload / 'outputs.env').write_text(
            'docs_source_commit=123456abcdef\ndocs_cn_source_commit=none\n'
            'docs_body_path=$(touch injected)\n')
        for path in ('docs', 'docs-cn', 'docs-toolkit/keyword_sync/data'):
            (self.directory / path).mkdir(parents=True)
        return payload

    def test_keyword_artifact_is_copied_as_data(self):
        self.keyword_payload()
        step = step_named(self.keyword, 'publish-keywords', 'Validate and apply generated data')
        result = run_script(step, self.directory)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.directory / 'docs/keywords.md').read_text(), 'generated data\n')
        self.assertFalse((self.directory / 'injected').exists())
        self.assertNotIn('body_path', (self.directory / 'outputs').read_text())

    def test_keyword_artifact_rejects_output_injection(self):
        payload = self.keyword_payload()
        (payload / 'outputs.env').write_text('docs_source_commit=$(touch injected)\ndocs_cn_source_commit=none\n')
        step = step_named(self.keyword, 'publish-keywords', 'Validate and apply generated data')
        self.assertNotEqual(run_script(step, self.directory).returncode, 0)
        self.assertFalse((self.directory / 'injected').exists())

    def test_keyword_artifact_rejects_extra_files(self):
        payload = self.keyword_payload()
        (payload / 'extra.sh').write_text('touch injected\n')
        step = step_named(self.keyword, 'publish-keywords', 'Validate and apply generated data')
        self.assertNotEqual(run_script(step, self.directory).returncode, 0)
        self.assertFalse((self.directory / 'docs/keywords.md').exists())

    def test_keyword_artifact_rejects_symlinks(self):
        payload = self.keyword_payload()
        (payload / 'docs-keywords.md').unlink()
        (payload / 'docs-keywords.md').symlink_to(payload / 'docs-cn-keywords.md')
        step = step_named(self.keyword, 'publish-keywords', 'Validate and apply generated data')
        self.assertNotEqual(run_script(step, self.directory).returncode, 0)

    def test_keyword_destination_rejects_symlinks(self):
        self.keyword_payload()
        protected = self.directory / 'protected'
        protected.write_text('original')
        (self.directory / 'docs/keywords.md').symlink_to(protected)
        step = step_named(self.keyword, 'publish-keywords', 'Validate and apply generated data')
        self.assertNotEqual(run_script(step, self.directory).returncode, 0)
        self.assertEqual(protected.read_text(), 'original')

    def test_llms_artifacts_only_allow_text_in_static(self):
        payload = self.directory / 'llms-payload/zh/tidb'
        payload.mkdir(parents=True)
        (payload / 'llms.txt').write_text('$(touch injected)\n')
        step = step_named(self.llms, 'publish-llms-txt', 'Validate and apply generated data')
        result = run_script(step, self.directory)
        self.assertEqual(result.returncode, 0, result.stderr)
        dest = self.directory / 'llms-workspace/website-docs/static/zh/tidb/llms.txt'
        self.assertEqual(dest.read_text(), '$(touch injected)\n')
        self.assertFalse((self.directory / 'injected').exists())
        (payload / 'execute.py').write_text('raise RuntimeError()')
        self.assertNotEqual(run_script(step, self.directory).returncode, 0)

    def test_llms_destination_rejects_symlink(self):
        payload = self.directory / 'llms-payload'
        payload.mkdir()
        (payload / 'llms.txt').write_text('generated')
        target = self.directory / 'llms-workspace/website-docs/static'
        target.parent.mkdir(parents=True)
        target.symlink_to(payload, target_is_directory=True)
        step = step_named(self.llms, 'publish-llms-txt', 'Validate and apply generated data')
        self.assertNotEqual(run_script(step, self.directory).returncode, 0)
        self.assertEqual((payload / 'llms.txt').read_text(), 'generated')


if __name__ == '__main__':
    unittest.main()
