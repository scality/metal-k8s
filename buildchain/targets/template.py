# coding: utf-8


"""Provides template rendering, using Python standard template engine."""


import shutil
import string
from typing import Any, Dict
from pathlib import Path

from buildchain import types
from buildchain import utils
from buildchain.targets.base import FileTarget


# In order to drastically reduce the escaping needs ($ is no fun in shell
# script…), we create a custom Template class with a delimiter character rare
# enough to (almost) never collide with legit one present in the input template
# files.
class CustomTemplate(string.Template):
    """Template class using § as delimiter."""
    delimiter = '@@'


class TemplateFile(FileTarget):
    """Create a new file from a template file."""

    def __init__(
        self,
        source: Path,
        destination: Path,
        context: Dict[str, Any],
        **kwargs: Any
    ):
        """Configure a template rendering task.

        Arguments:
            source:      path to the input template file
            destination: path to the rendered file
            context:     values for the placeholders

        Keyword Arguments:
            They are passed to `FileTarget` init method.
        """
        # Insert in front, to have an informative title.
        kwargs.setdefault('file_dep', []).insert(0, source)
        super().__init__(destination=destination, **kwargs)
        self._src = source
        self._dst = destination
        self._ctx = context

    @property
    def task(self) -> types.TaskDict:
        task = self.basic_task
        task.update({
            'title': self._show,
            'doc': 'Render template {}.'.format(self._src.name),
            'actions': [self._run],
        })
        return task

    @staticmethod
    def _show(task: types.Task) -> str:
        """Return a description of the task."""
        return utils.title_with_target1('RENDER', task)

    def _run(self) -> None:
        """Render the template."""
        template = self._src.read_text(encoding='utf-8')
        rendered = CustomTemplate(template).substitute(**self._ctx)
        self._dst.write_text(rendered, encoding='utf-8')
        # Preserve the permission bits.
        shutil.copymode(self._src, self._dst)
