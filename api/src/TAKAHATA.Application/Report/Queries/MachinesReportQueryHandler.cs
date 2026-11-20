using ErrorOr;
using MediatR;
using TAKAHATA.Application.Common.Interface.Repositories;
using TAKAHATA.Contracts.Report;

namespace TAKAHATA.Application.Report.Queries
{
    public class MachinesReportQueryHandler : IRequestHandler<MachinesReportQuery, ErrorOr<MachineReportResponse>>
    {
        private readonly IMachineRepository _machineLogRepository;
        private readonly IPartProcessRepository _partProcessRepository;

        public MachinesReportQueryHandler(
            IMachineRepository machineLogRepository,
            IPartProcessRepository partProcessRepository)
        {
            _machineLogRepository = machineLogRepository;
            _partProcessRepository = partProcessRepository;
        }

        public async Task<ErrorOr<MachineReportResponse>> Handle(
            MachinesReportQuery request,
            CancellationToken cancellationToken)
        {
            var machineKpis = await _machineLogRepository.SearchKPIAsync(request.SearchMachineKeyword, request.From, request.To);
            var partProcessKpis = await _partProcessRepository.SearchKPIAsync(
                request.SearchMachineKeyword,
                null,
                null,
                request.From,
                request.To);
            var planTimesByMachineAndDate = partProcessKpis
                .Where(item =>
                    item.ReportDate.HasValue &&
                    !string.IsNullOrWhiteSpace(item.MachineCode))
                .GroupBy(item => (
                    MachineCode: item.MachineCode!,
                    ReportDate: item.ReportDate!.Value))
                .ToDictionary(
                    group => group.Key,
                    group => (
                        WorkingTime: group.Sum(item => item.WorkingTime ?? 0),
                        WaitingTime: group.Sum(item => item.WaitingTime ?? 0),
                        SetupTime: group.Sum(item => item.SetupTime ?? 0)));

            foreach (var machineKpi in machineKpis)
            {
                if (!planTimesByMachineAndDate.TryGetValue(
                        (machineKpi.Code, machineKpi.ReportDate),
                        out var planTimes))
                {
                    continue;
                }

                var planTotalTime =
                    planTimes.WorkingTime +
                    planTimes.WaitingTime +
                    planTimes.SetupTime;
                var machineTotalTime =
                    (machineKpi.WorkingTime ?? 0) +
                    (machineKpi.WaitingTime ?? 0) +
                    (machineKpi.SetupTime ?? 0);
                if (planTotalTime <= 0 || machineTotalTime > 0)
                    continue;

                machineKpi.WorkingTime = planTimes.WorkingTime;
                machineKpi.WaitingTime = planTimes.WaitingTime;
                machineKpi.SetupTime = planTimes.SetupTime;
                machineKpi.UtilizationRate = planTotalTime / 24d * 100;
                machineKpi.LostTime = Math.Max(24d - planTotalTime, 0);
            }

            var response = new MachineReportResponse
            {
                MachineKPIs = machineKpis
            };

            return response;
        }
    }
}
