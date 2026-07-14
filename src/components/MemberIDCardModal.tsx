import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { 
  X, 
  Printer, 
  Download, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Heart, 
  MapPin, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  ArrowLeftRight,
  FileDown
} from 'lucide-react';
import { Member, formatMemberName, getDefaultAvatar, getCleanAvatar } from '../types';

interface MemberIDCardModalProps {
  member: Member;
  isOpen: boolean;
  onClose: () => void;
}

export const MemberIDCardModal: React.FC<MemberIDCardModalProps> = ({ member, isOpen, onClose }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [selectedSide, setSelectedSide] = useState<'both' | 'front' | 'back'>('both');

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate QR Code containing structured member details
  useEffect(() => {
    if (isOpen && member) {
      const qrData = JSON.stringify({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        bial: member.bial || 'N/A',
        status: member.status,
        verified_date: new Date(member.created_at || Date.now()).toLocaleDateString()
      }, null, 2);

      QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 160,
        color: {
          dark: '#064e3b', // Deep emerald dark
          light: '#ffffff' // Pure white background
        }
      })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Failed to generate ID Card QR Code:', err));
    }
  }, [isOpen, member]);

  if (!isOpen) return null;

  // Render front of the ID card to PNG
  const downloadFrontAsPng = async () => {
    if (!frontRef.current) return;
    setIsDownloading(true);
    setDownloadProgress('Generating front image...');
    try {
      const dataUrl = await toPng(frontRef.current, { 
        pixelRatio: 3, 
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
        }
      });
      const link = document.createElement('a');
      link.download = `SY_ID_Front_${member.name.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating front PNG:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  // Render back of the ID card to PNG
  const downloadBackAsPng = async () => {
    if (!backRef.current) return;
    setIsDownloading(true);
    setDownloadProgress('Generating back image...');
    try {
      const dataUrl = await toPng(backRef.current, { 
        pixelRatio: 3, 
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
        }
      });
      const link = document.createElement('a');
      link.download = `SY_ID_Back_${member.name.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating back PNG:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  // Download both sides as separate images or a combined layout
  const downloadBothAsPng = async () => {
    await downloadFrontAsPng();
    setTimeout(async () => {
      await downloadBackAsPng();
    }, 400);
  };

  // Generate a high resolution printable PDF card layout
  const downloadAsPdf = async () => {
    if (!frontRef.current || !backRef.current) return;
    setIsDownloading(true);
    setDownloadProgress('Compiling PDF Badge...');
    try {
      const frontDataUrl = await toPng(frontRef.current, { pixelRatio: 3 });
      const backDataUrl = await toPng(backRef.current, { pixelRatio: 3 });

      // CR80 is 85.6mm x 54mm. We place them side by side on an A4 page or a single custom small page.
      // Standard ID badge printer format or clean printable layout:
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Add elegant title and metadata to top of A4 sheet
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(6, 78, 59); // Deep Emerald
      pdf.text('SHALOM YOUTH - MEMBER IDENTIFICATION BADGE', 20, 25);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()} | Member ID: ${member.id}`, 20, 31);
      pdf.text('Cut along the borders, fold in half, and laminate for standard double-sided CR80 badge.', 20, 36);

      // Draw guides or instructions
      pdf.setDrawColor(220, 225, 230);
      pdf.line(20, 42, 190, 42);

      // Card Dimensions in PDF (approx 85.6mm x 54mm)
      // Standard vertical badge layout
      const cardW = 54;
      const cardH = 85.6;

      // Position Cards
      // Front on left
      pdf.addImage(frontDataUrl, 'PNG', 35, 55, cardW, cardH);
      // Back on right
      pdf.addImage(backDataUrl, 'PNG', 115, 55, cardW, cardH);

      // Draw border cutting outlines
      pdf.setDrawColor(210, 215, 220);
      pdf.rect(35, 55, cardW, cardH);
      pdf.rect(115, 55, cardW, cardH);

      // Add a clean solid folding guide line
      pdf.line(100, 50, 100, 150);
      
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('FRONT SIDE', 35 + (cardW/2), 52, { align: 'center' });
      pdf.text('BACK SIDE', 115 + (cardW/2), 52, { align: 'center' });

      pdf.save(`SY_ID_Badge_${member.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  // Direct trigger window print with scoped printable target
  const handlePrint = () => {
    window.print();
  };

  const formattedDob = member.dob ? new Date(member.dob).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : 'N/A';

  const memberSince = member.created_at ? new Date(member.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : new Date().toLocaleDateString();

  const isOB = ['Founder', 'Admin', 'Chairman', 'Vice Chairman', 'Secretary', 'Assistant Secretary', 'Treasurer', 'Financial Secretary'].includes(member.role);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
        
        {/* Scoped printing stylesheet injected dynamically */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-id-card-area, #printable-id-card-area * {
              visibility: visible !important;
            }
            #printable-id-card-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              display: flex !important;
              flex-direction: row !important;
              justify-content: center !important;
              gap: 20px !important;
              background: white !important;
              padding: 40px !important;
            }
            /* Eliminate margins, headers, footers in print window */
            @page {
              size: auto;
              margin: 10mm;
            }
          }
        `}} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-stone-50 dark:bg-stone-900 rounded-2xl max-w-4xl w-full flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 my-8"
        >
          {/* Header Controls */}
          <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Printable Member ID Card
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Official double-sided CR80 badge design with event scanning QR code.
              </p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="ml-auto sm:ml-0 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all cursor-pointer"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="bg-stone-100 dark:bg-stone-950 p-4 border-b border-stone-200 dark:border-stone-850 flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-stone-200/65 dark:bg-stone-850 p-1 rounded-xl gap-1">
              <button
                onClick={() => setSelectedSide('both')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${selectedSide === 'both' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xxs' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'}`}
              >
                Show Both Sides
              </button>
              <button
                onClick={() => setSelectedSide('front')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${selectedSide === 'front' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xxs' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'}`}
              >
                Front Only
              </button>
              <button
                onClick={() => setSelectedSide('back')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${selectedSide === 'back' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xxs' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'}`}
              >
                Back Only
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-stone-300 dark:border-stone-700"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Card
              </button>

              <button
                onClick={downloadAsPdf}
                disabled={isDownloading}
                className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-3.5 h-3.5" />
                Download PDF
              </button>

              <div className="relative group">
                <button
                  disabled={isDownloading}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save Image(s)
                </button>
                <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-stone-850 rounded-xl shadow-xl border border-stone-200 dark:border-stone-850 py-1 hidden group-hover:block z-50">
                  <button 
                    onClick={downloadFrontAsPng} 
                    className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    Front Side PNG
                  </button>
                  <button 
                    onClick={downloadBackAsPng} 
                    className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    Back Side PNG
                  </button>
                  <div className="border-t border-stone-100 dark:border-stone-800 my-1"></div>
                  <button 
                    onClick={downloadBothAsPng} 
                    className="w-full text-left px-3 py-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    Download Both PNGs
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Download Loader status message */}
          {isDownloading && (
            <div className="bg-emerald-500 text-white text-xs px-4 py-2 text-center font-bold flex items-center justify-center gap-2 animate-pulse">
              <span className="w-3.5 h-3.5 border border-t-transparent border-white rounded-full animate-spin"></span>
              {downloadProgress || 'Preparing download assets...'}
            </div>
          )}

          {/* Main Printable Card Container area */}
          <div className="p-8 flex items-center justify-center bg-stone-250 dark:bg-stone-950 overflow-x-auto min-h-[500px]">
            <div 
              id="printable-id-card-area"
              ref={containerRef}
              className="flex flex-col md:flex-row items-center justify-center gap-8 py-4 px-2"
            >
              
              {/* Front Side Card */}
              {(selectedSide === 'both' || selectedSide === 'front') && (
                <div 
                  ref={frontRef}
                  id="card-front"
                  className="w-72 h-[456px] bg-white text-stone-900 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden border border-stone-200/80 relative shrink-0"
                  style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                >
                  {/* Decorative curved top background representing peace/youth */}
                  <div className="absolute top-0 inset-x-0 h-40 bg-linear-to-b from-emerald-800 to-emerald-600 overflow-hidden">
                    {/* Semi circle ambient rings */}
                    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full border-8 border-emerald-500/10"></div>
                    <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-emerald-500/10"></div>
                    
                    {/* Tiny watermark */}
                    <div className="absolute bottom-2 right-3 text-emerald-300/35 uppercase text-[7px] font-extrabold tracking-widest">
                      Shalom Youth Member ID
                    </div>
                  </div>

                  {/* Top Content: Logo, Institution Title */}
                  <div className="p-4 pt-5 text-center relative z-10">
                    <h4 className="text-stone-100 font-extrabold tracking-widest text-[13px] leading-tight flex items-center justify-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      SHALOM YOUTH
                    </h4>
                    <p className="text-[8px] text-emerald-100/85 font-bold uppercase tracking-widest mt-0.5">
                      Youth Association Badge
                    </p>
                  </div>

                  {/* Middle Content: Avatar photo, name, badge */}
                  <div className="flex flex-col items-center justify-center mt-2 relative z-10 px-4">
                    {/* Frame for Profile Picture */}
                    <div className="w-28 h-28 rounded-full border-4 border-white bg-white shadow-md overflow-hidden relative group">
                      <img
                        src={getCleanAvatar(member.avatar) || getDefaultAvatar(member.gender)}
                        alt={member.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="mt-3.5 text-center w-full">
                      <h3 className="text-base font-extrabold text-stone-900 tracking-tight leading-tight uppercase truncate">
                        {formatMemberName(member.name, member.gender)}
                      </h3>
                      
                      <div className="mt-1 flex justify-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isOB ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
                          {member.role === 'standard' ? 'Youth Member' : member.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Content: ID Number, Bial group, Blood Group details */}
                  <div className="bg-stone-50 border-t border-stone-100 p-4 flex flex-col justify-end">
                    
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-left mb-2">
                      <div>
                        <span className="text-[8px] text-stone-400 uppercase tracking-widest font-bold block">Member ID</span>
                        <span className="text-[10px] font-mono font-extrabold text-stone-800 block truncate">{member.id.substring(0, 8).toUpperCase()}...</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-stone-400 uppercase tracking-widest font-bold block">Bial (Group)</span>
                        <span className="text-[10px] font-bold text-stone-800 block truncate">{member.bial || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-stone-200/80 my-1.5"></div>

                    <div className="flex items-center justify-between">
                      {member.blood_group && (
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                          <span className="text-[9px] font-extrabold text-stone-700">Blood: {member.blood_group}</span>
                        </div>
                      )}
                      
                      <div className="ml-auto flex items-center gap-0.5 bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded-sm text-[8px] font-extrabold border border-emerald-100">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 fill-emerald-100 shrink-0" />
                        <span>VERIFIED MEMBER</span>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Back Side Card */}
              {(selectedSide === 'both' || selectedSide === 'back') && (
                <div 
                  ref={backRef}
                  id="card-back"
                  className="w-72 h-[456px] bg-white text-stone-900 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden border border-stone-200/80 relative shrink-0"
                  style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                >
                  {/* Matching Emerald Header accent */}
                  <div className="h-2 bg-emerald-600 w-full"></div>

                  <div className="p-4 flex flex-col items-center flex-grow justify-center space-y-4">
                    
                    {/* Frame for QR Code */}
                    <div className="flex flex-col items-center">
                      <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-150 shadow-xxs">
                        {qrCodeUrl ? (
                          <img 
                            src={qrCodeUrl} 
                            alt="Scan Badge QR Code" 
                            className="w-32 h-32 object-contain"
                          />
                        ) : (
                          <div className="w-32 h-32 bg-stone-100 flex items-center justify-center text-stone-400 text-[10px] font-bold">
                            Generating QR Code...
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] text-emerald-700 dark:text-emerald-500 uppercase tracking-widest font-black mt-2 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Event Scan Identification
                      </span>
                    </div>

                    {/* Member back details */}
                    <div className="w-full px-2 space-y-1.5 text-left text-xs text-stone-700">
                      
                      <div className="flex items-center justify-between text-[10px] py-1 border-b border-stone-100">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[8px]">Email Address</span>
                        <span className="font-semibold text-stone-800 truncate max-w-[150px]">{member.email}</span>
                      </div>

                      {member.phone && (
                        <div className="flex items-center justify-between text-[10px] py-1 border-b border-stone-100">
                          <span className="text-stone-400 font-bold uppercase tracking-wider text-[8px]">Phone Number</span>
                          <span className="font-semibold text-stone-800">{member.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] py-1 border-b border-stone-100">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[8px]">Date of Birth</span>
                        <span className="font-semibold text-stone-800">{formattedDob}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] py-1 border-b border-stone-100">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[8px]">Join Date</span>
                        <span className="font-semibold text-stone-800">{memberSince}</span>
                      </div>

                    </div>
                  </div>

                  {/* Footing disclaimer & signature sign-off */}
                  <div className="p-4 bg-stone-50 border-t border-stone-100 text-center space-y-2">
                    <p className="text-[7px] text-stone-400 leading-normal font-medium max-w-[240px] mx-auto uppercase">
                      This badge is official property of Shalom Youth. If found, please return to any Shalom Youth center or return to administrative services.
                    </p>
                    
                    <div className="pt-2 flex items-center justify-between border-t border-dashed border-stone-200">
                      <div className="text-left">
                        <p className="text-[6px] text-stone-400 uppercase tracking-widest font-bold">Authorized signature</p>
                        <p className="text-[10px] font-serif italic text-emerald-800 font-bold mt-0.5 tracking-wide">
                          Shalom Youth Admin
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-[6px] text-stone-400 uppercase tracking-widest font-bold">Verification stamp</p>
                        <p className="text-[8px] font-bold text-emerald-700 mt-1 uppercase tracking-widest font-mono">
                          SY-{member.id.substring(0,4).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

          {/* Footer Guide details */}
          <div className="p-5 bg-stone-100 dark:bg-stone-950 border-t border-stone-200 dark:border-stone-850 rounded-b-2xl text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>
              ℹ️ Tip: Download the **PDF document** to print a high-resolution double-sided folding badge template.
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold shadow-xxs transition-all cursor-pointer"
            >
              Close ID Badge Panel
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
