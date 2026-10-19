package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import java.util.Date;
import lombok.Data;

@Data
@ApiModel("DynamicPeerEvalSubmission")
public class DynamicPeerEvalSubmission {

  @ApiModelProperty("submission id1")
  private String submission_id1;

  @ApiModelProperty("submission id2")
  private String submission_id2;

  @ApiModelProperty("unique id")
  private String unique_id;

  @ApiModelProperty("submit time")
  private Date submit_time;

  @ApiModelProperty("multiple choices")
  private String choices;

  @ApiModelProperty("free responses json")
  private String free_responses;
}
