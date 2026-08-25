"""Shared test setup for VERIFY direct-mode tests.

Includes the Windows compatibility shim for gltest 0.29.2 direct mode:
the library deletes its stdin temp file while fd 0 still references it,
which POSIX allows but Windows forbids (WinError 32). Here we defer that
delete until after the VM restores the original stdin.

If a future gltest version changes the internal function shape, the shim
detects the drift, stays out of the way, and says so loudly.
"""
import inspect
import os

import pytest


def _install_windows_stdin_shim() -> None:
    import gltest.direct.loader as loader
    import gltest.direct.vm as vm_mod

    if getattr(loader, "_verify_stdin_shim_installed", False):
        return

    original_inject = getattr(loader, "_inject_message_to_fd0", None)
    original_cleanup = getattr(vm_mod.VMContext, "_cleanup_after_deactivate", None)
    if original_inject is None or original_cleanup is None:
        return

    source = inspect.getsource(original_inject)
    required_markers = ("mkstemp", "entry_kind", "dup2")
    if not all(marker in source for marker in required_markers):
        print(
            "\n[verify conftest] gltest _inject_message_to_fd0 changed shape; "
            "Windows stdin shim NOT applied."
        )
        return

    def patched_inject(vm):
        import tempfile

        try:
            from genlayer.py import calldata
            from genlayer.py.types import Address
        except ImportError:
            return

        sender_addr = vm.sender
        if isinstance(sender_addr, bytes):
            sender_addr = Address(sender_addr)
        contract_addr = vm._contract_address
        if isinstance(contract_addr, bytes):
            contract_addr = Address(contract_addr)
        origin_addr = vm.origin
        if isinstance(origin_addr, bytes):
            origin_addr = Address(origin_addr)

        message_data = {
            "contract_address": contract_addr,
            "sender_address": sender_addr,
            "origin_address": origin_addr,
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        }
        encoded = calldata.encode(message_data)

        fd, path = tempfile.mkstemp()
        try:
            os.write(fd, encoded)
            os.lseek(fd, 0, os.SEEK_SET)
            original_stdin = os.dup(0)
            vm._original_stdin_fd = original_stdin
            os.dup2(fd, 0)
        finally:
            os.close(fd)
            try:
                os.unlink(path)
            except OSError:
                # Windows: fd 0 still references the file until the VM
                # restores stdin. Defer the delete to cleanup time.
                vm._verify_deferred_unlink = path

    def patched_cleanup(self):
        path = getattr(self, "_verify_deferred_unlink", None)
        try:
            original_cleanup(self)
        finally:
            if path:
                try:
                    os.unlink(path)
                except OSError:
                    pass
                self._verify_deferred_unlink = None

    loader._inject_message_to_fd0 = patched_inject
    vm_mod.VMContext._cleanup_after_deactivate = patched_cleanup
    loader._verify_stdin_shim_installed = True


def pytest_configure(config):
    try:
        _install_windows_stdin_shim()
    except ImportError:
        # gltest not installed — surface tests still run without it.
        pass
