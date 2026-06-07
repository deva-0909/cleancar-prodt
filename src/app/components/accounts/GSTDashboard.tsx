import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  FileText, Download, AlertCircle,
  TrendingUp, IndianRupee, Receipt, Calendar, TrendingDown
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { useMemo } from "react";
import { useCustomerSubscriptions, useCustomers } from "../../contexts/AppProvider";
import { gstComplianceService } from "../../services/gstComplianceService";

export function GSTDashboard() {
  const { subscriptions: customerSubscriptions } = useCustomerSubscriptions();
  const { customers } = useCustomers();
  const savedTransactions = gstComplianceService.getTransactions();
  const savedVendors = gstComplianceService.getVendors();

  // Calculate GST from real subscription data (18% GST rate)
  const gstPayableLedger = useMemo(() =>
    customerSubscriptions.map((sub, idx) => {
      const customer = customers.find(c => c.customerId === sub.customerId);
      const customerName = customer?.name || "Unknown Customer";
      const revenue = sub.pricing?.finalPrice || sub.priceLocked || 0;

      return {
        id: idx + 1,
        subscription: `${sub.packageType} - ${customerName}`,
        customerName,
        planType: sub.packageType,
        vehicleCategory: sub.serviceDetails?.vehicleType || "Unknown",
        revenue,
        // ✅ H05 FIX: Intra-state = 9% CGST + 9% SGST (not 18% IGST)
        cgst: Math.round(revenue * 0.09),
        sgst: Math.round(revenue * 0.09),
        igst: 0,
        gst: Math.round(revenue * 0.18), // total tax (cgst+sgst) kept for backward compat
        date: `2026-03-${String(idx + 1).padStart(2, '0')}`,
      };
    }),
    [customerSubscriptions, customers]
  );

  const totalRevenue = useMemo(() =>
    customerSubscriptions.reduce((sum, sub) => sum + (sub.pricing?.finalPrice || sub.priceLocked || 0), 0),
    [customerSubscriptions]
  );

  const totalGST = useMemo(() =>
    // ✅ H05 FIX: For intra-state (Surat) the total tax is CGST+SGST = 18% total
    // but it should be reported as CGST 9% and SGST 9% separately in GSTR-1
    Math.round(totalRevenue * 0.09) + Math.round(totalRevenue * 0.09), // CGST+SGST
    [totalRevenue]
  );

  const gstPayableData = useMemo(() => {
    const CHART_MONTHS = [
      { label: "Oct", num: 10 }, { label: "Nov", num: 11 }, { label: "Dec", num: 12 },
      { label: "Jan", num: 1  }, { label: "Feb", num: 2  }, { label: "Mar", num: 3  },
    ];
    const now = new Date();
    const fy  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return CHART_MONTHS.map(({ label, num }) => {
      const year = num >= 4 ? fy : fy + 1;
      const txns = savedTransactions.filter(t => {
        const d = new Date(t.invoiceDate);
        return d.getMonth() + 1 === num && d.getFullYear() === year;
      });
      const payable = txns.filter(t => t.transactionType === "Sale" && t.status === "Approved").reduce((s, t) => s + t.totalTax, 0);
      const credit  = txns.filter(t => t.transactionType === "Purchase" && t.itcEligible && t.status === "Approved").reduce((s, t) => s + t.itcAmount, 0);
      return { month: label, payable, credit, net: Math.max(0, payable - credit), id: `gst-${label.toLowerCase()}` };
    });
  }, [savedTransactions]);

  const inputCreditData = savedTransactions
    .filter(t => t.transactionType === "Purchase" && t.totalTax > 0)
    .map((t, i) => ({
      id: i + 1,
      vendor: t.partyName || "Unknown Vendor",
      invoice: t.invoiceNumber,
      gst: t.totalTax,
      date: t.invoiceDate,
      status: t.status === "Validated" ? "Verified" : "Pending",
    }));

  const exportReport = (reportType: string) => {
    const data = reportType === "input-credit" ? inputCreditData : savedTransactions;
    const csv = [
      Object.keys(data[0] || {}).join(","),
      ...data.map(row => Object.values(row).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst-${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Management Module</h1>
          <p className="text-sm text-gray-500 mt-1">Independent GST tracking and reporting system</p>
        </div>
        <Link to="/accounts">
          <Button variant="outline" size="sm">Back to Accounts</Button>
        </Link>
      </div>

      {/* Auto Calculation Notice */}
      <Card className="bg-blue-50 border-blue-300">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">Automatic GST Calculation</p>
              <p className="text-sm text-blue-700 mt-1">
                GST calculations run automatically on the 2nd day of every month for the previous month's transactions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GST Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Subscriptions</p>
                <p className="text-2xl font-bold mt-1">₹4.35L</p>
                <p className="text-xs text-gray-500 mt-1">This Month</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">GST Collected</p>
                <p className="text-2xl font-bold mt-1">₹78K</p>
                <p className="text-xs text-red-600 mt-1">From subscriptions</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">GST Input Credit</p>
                <p className="text-2xl font-bold mt-1">₹42K</p>
                <p className="text-xs text-green-600 mt-1">Available</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingDown className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Net GST Liability</p>
                <p className="text-2xl font-bold mt-1">₹36K</p>
                <p className="text-xs text-orange-600 mt-1">Payable</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GST Calculation Formula */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-base">GST Calculation Formula</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 text-lg font-medium">
            <div className="p-4 bg-red-100 rounded-lg text-red-700">
              GST Payable: ₹78,000
            </div>
            <span className="text-gray-500">−</span>
            <div className="p-4 bg-green-100 rounded-lg text-green-700">
              GST Input Credit: ₹42,000
            </div>
            <span className="text-gray-500">=</span>
            <div className="p-4 bg-orange-100 rounded-lg text-orange-700 font-bold">
              Net Liability: ₹36,000
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GST Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GST Trend (6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gstPayableData} id="gst-bar-chart">
              <CartesianGrid strokeDasharray="3 3" key="grid-gst" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} key="xaxis-gst" />
              <YAxis key="yaxis-gst" tick={{ fontSize: 11 }} width={50} />
              <Tooltip key="tooltip-gst" />
              <Legend key="legend-gst" />
              <Bar dataKey="payable" fill="#ef4444" name="GST Payable" isAnimationActive={false} />
              <Bar dataKey="credit" fill="#10b981" name="Input Credit" isAnimationActive={false} />
              <Bar dataKey="net" fill="#f59e0b" name="Net Liability" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* GST Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GST Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => exportReport("Monthly GST Summary")}>
              <Download className="w-4 h-4 mr-2" />
              Monthly Summary
            </Button>
            <Button variant="outline" onClick={() => exportReport("Input Credit Ledger")}>
              <Download className="w-4 h-4 mr-2" />
              Input Credit
            </Button>
            <Button variant="outline" onClick={() => exportReport("GST Payable Ledger")}>
              <Download className="w-4 h-4 mr-2" />
              GST Payable
            </Button>
            <Button variant="outline" onClick={() => exportReport("Vendor GST Register")}>
              <Download className="w-4 h-4 mr-2" />
              Vendor Register
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input Credit Ledger */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">GST Input Credit Ledger</CardTitle>
              <Badge>Last Updated: Mar 2, 2026</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>GST Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inputCreditData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.vendor}</TableCell>
                    <TableCell>{item.invoice}</TableCell>
                    <TableCell>₹{(item?.gst ?? 0).toLocaleString()}</TableCell>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "Verified" ? "secondary" : "default"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* GST Payable Ledger */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">GST Payable Ledger</CardTitle>
              <Badge>Last Updated: Mar 2, 2026</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>GST (18%)</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gstPayableLedger.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.subscription}</TableCell>
                    <TableCell>₹{(item?.revenue ?? 0).toLocaleString()}</TableCell>
                    <TableCell>₹{(item?.gst ?? 0).toLocaleString()}</TableCell>
                    <TableCell>{item.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}