"""Importers turn files into normalized transactions and receipts.

Each importer is independent. To add a format, write a function that returns
a list of ParsedTransaction (or ParsedReceipt) and register it in `import_file`.
"""
from .common import ImportResult, import_file  # noqa: F401
