using System;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading;

class Launcher
{
    static void Main()
    {
        string appDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
        string serverDir = Path.Combine(appDir, "server");
        string configPath = Path.Combine(appDir, "config.json");

        int port = 4357;
        string host = "0.0.0.0";

        if (File.Exists(configPath))
        {
            try
            {
                string json = File.ReadAllText(configPath);
                var portMatch = Regex.Match(json, @"""port""\s*:\s*(\d+)");
                if (portMatch.Success) port = int.Parse(portMatch.Groups[1].Value);
                var hostMatch = Regex.Match(json, @"""host""\s*:\s*""([^""]+)""");
                if (hostMatch.Success) host = hostMatch.Groups[1].Value;
            }
            catch {}
        }

        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.WriteLine();
        Console.WriteLine("  ================================================");
        Console.WriteLine("    نظام القيود اليومية المحاسبية");
        Console.WriteLine("  ================================================");
        Console.WriteLine();
        Console.WriteLine("  جاري تشغيل السيرفر...");
        Console.WriteLine("  المنفذ: " + port);
        Console.WriteLine("  الرابط: http://localhost:" + port);
        Console.WriteLine();
        Console.WriteLine("  اضغط Ctrl+C لإيقاف السيرفر");
        Console.WriteLine("  ================================================");
        Console.WriteLine();

        Process proc = null;
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "node";
            psi.Arguments = "src/index.js";
            psi.WorkingDirectory = serverDir;
            psi.UseShellExecute = false;

            proc = Process.Start(psi);
            Console.WriteLine("  OK: تم تشغيل السيرفر بنجاح!");

            Thread.Sleep(2000);

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "http://localhost:" + port,
                    UseShellExecute = true
                });
                Console.WriteLine("  تم فتح المتصفح...");
            }
            catch
            {
                Console.WriteLine("  لم يتم فتح المتصفح تلقائياً");
                Console.WriteLine("  افتح المتصفح يدوياً: http://localhost:" + port);
            }

            if (proc != null)
            {
                proc.WaitForExit();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine();
            Console.WriteLine("  خطأ: " + ex.Message);
            Console.WriteLine();
            Console.WriteLine("  تأكد من تثبيت Node.js من: https://nodejs.org");
        }

        Console.WriteLine();
        Console.WriteLine("  اضغط أي مفتاح للإنهاء...");
        try { Console.ReadKey(); } catch {}
    }
}
