import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { recordReportExport } from "../../../shared/reportHistory";

interface ExportButtonsProps {
  circleId: number;
  reportType: 'memorization' | 'attendance' | 'students';
  startDate?: string;
  endDate?: string;
  className?: string;
}

export function ExportButtons({
  circleId,
  reportType,
  startDate,
  endDate,
  className = '',
}: ExportButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const utils = trpc.useUtils();

  const handleExport = async (format: 'excel' | 'pdf' | 'csv' | 'word') => {
    try {
      setIsLoading(true);

      let result: any;

      if (reportType === 'memorization') {
        result = await utils.client.export.memorizationReport.mutate({
          circleId,
          startDate,
          endDate,
          format,
        });
      } else if (reportType === 'attendance') {
        if (!startDate || !endDate) {
          toast.error('يرجى تحديد نطاق التاريخ');
          return;
        }
        result = await utils.client.export.attendanceReport.mutate({
          circleId,
          startDate,
          endDate,
          format,
        });
      } else if (reportType === 'students') {
        result = await utils.client.export.studentsReport.mutate({
          circleId,
          format,
        });
      }

      if (result?.data) {
        // تحويل Base64 إلى Blob
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: result.contentType,
        });

        // إنشاء رابط التحميل
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success(`تم تحميل التقرير بنجاح: ${result.filename}`);
        recordReportExport({ filename: result.filename, reportType, format });
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'حدث خطأ أثناء تصدير التقرير');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        onClick={() => handleExport('excel')}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="gap-2"
        title="تصدير إلى Excel"
      >
        <Sheet className="w-4 h-4" />
        <span className="hidden sm:inline">Excel</span>
      </Button>
      <Button
        onClick={() => handleExport('pdf')}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="gap-2"
        title="تصدير إلى PDF"
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">PDF</span>
      </Button>
      <Button onClick={() => handleExport('csv')} disabled={isLoading} variant="outline" size="sm" className="gap-2" title="تصدير إلى CSV">
        <FileSpreadsheet className="w-4 h-4" />
        <span className="hidden lg:inline">CSV</span>
      </Button>
      <Button onClick={() => handleExport('word')} disabled={isLoading} variant="outline" size="sm" className="gap-2" title="تصدير إلى Word">
        <FileText className="w-4 h-4" />
        <span className="hidden lg:inline">Word</span>
      </Button>
    </div>
  );
}
