using ErrorOr;
using MediatR;
using TAKAHATA.Contracts.MaintenanceProcess;

namespace TAKAHATA.Application.MaintenanceProcess.Commands
{
    public enum MachineMaintenanceAction
    {
        Start = 0,
        Pause = 1,
        Resume = 2,
        Complete = 3
    }

    public record OperateMachineMaintenanceProcessCommand(
        int Id,
        MachineMaintenanceAction Action,
        string PerformedBy) : IRequest<ErrorOr<MachineMaintenanceProcessResponse>>;
}
