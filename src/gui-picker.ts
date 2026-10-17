import { spawn } from 'child_process';
import os from 'os';

/**
 * Opens a native Windows GUI FolderBrowserDialog in the foreground.
 * Returns the selected absolute directory path or null if canceled.
 */
export async function openWindowsFolderPicker(
  description = 'Select a Project Folder',
  initialDir?: string
): Promise<string | null> {
  if (os.platform() !== 'win32') {
    return null;
  }

  return new Promise((resolve) => {
    // Escape single quotes for PowerShell script literals
    const safeDesc = description.replace(/'/g, "''");
    const safePath = (initialDir || '').replace(/'/g, "''");

    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
      $dialog.Description = '${safeDesc}'
      $initial = '${safePath}'
      if ($initial -ne '' -and (Test-Path -LiteralPath $initial)) {
        $dialog.SelectedPath = $initial
      }
      $dialog.ShowNewFolderButton = $true
      $form = New-Object System.Windows.Forms.Form
      $form.TopMost = $true
      $res = $dialog.ShowDialog($form)
      if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        Write-Output $dialog.SelectedPath
      }
    `.trim();

    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-Sta',
      '-Command',
      psScript,
    ]);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    ps.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ps.on('error', () => {
      resolve(null);
    });

    ps.on('close', (code) => {
      if (code === 0 && stdout.trim().length > 0) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Opens a native Windows GUI OpenFileDialog in the foreground.
 * Returns the selected absolute file path or null if canceled.
 */
export async function openWindowsFilePicker(
  title = 'Select a Script or Skill File',
  filter = 'Script Files (*.py;*.ts;*.js;*.json;*.sh;*.md)|*.py;*.ts;*.js;*.json;*.sh;*.md|All Files (*.*)|*.*',
  initialDir?: string
): Promise<string | null> {
  if (os.platform() !== 'win32') {
    return null;
  }

  return new Promise((resolve) => {
    const safeTitle = title.replace(/'/g, "''");
    const safeFilter = filter.replace(/'/g, "''");
    const safePath = (initialDir || '').replace(/'/g, "''");

    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $dialog = New-Object System.Windows.Forms.OpenFileDialog
      $dialog.Title = '${safeTitle}'
      $dialog.Filter = '${safeFilter}'
      $initial = '${safePath}'
      if ($initial -ne '' -and (Test-Path -LiteralPath $initial)) {
        $dialog.InitialDirectory = $initial
      }
      $form = New-Object System.Windows.Forms.Form
      $form.TopMost = $true
      $res = $dialog.ShowDialog($form)
      if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        Write-Output $dialog.FileName
      }
    `.trim();

    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-Sta',
      '-Command',
      psScript,
    ]);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    ps.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ps.on('error', () => {
      resolve(null);
    });

    ps.on('close', (code) => {
      if (code === 0 && stdout.trim().length > 0) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
}

