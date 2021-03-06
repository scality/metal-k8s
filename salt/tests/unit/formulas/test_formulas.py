"""Tests for rendering formulas.

Currently only define a single test function, focused on rendering any Jinja template
available under the salt/ directory.
"""
from pathlib import Path
from typing import Iterable

import jinja2
import pytest

from tests.unit.formulas.fixtures.context import Context


@pytest.mark.formulas
def test_template_renders(
    environment: jinja2.Environment,
    render_contexts: Iterable[Context],
    template_path: Path,
) -> None:
    """Check that a Jinja template can render without errors."""
    template = environment.get_template(str(template_path))

    for context in render_contexts:
        try:
            template.render(**context.data)
        except jinja2.exceptions.TemplateError as exc:
            error_parts = [
                f"Failed to render {template_path}:",
                f"  Test case: {context.id}",
            ]
            error_parts.append(f"  Error: [{exc.__class__.__qualname__}] {exc!s}")
            pytest.fail("\n".join(error_parts))
